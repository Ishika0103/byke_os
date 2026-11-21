import { Types } from 'mongoose';
import type {
  CreateRoomTypeInput,
  Paginated,
  RoomType,
  RoomTypeListQuery,
  UpdateRoomTypeInput,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { codeFromName, firstFreeCode } from '../../utils/code';
import { escapeRegex, toSort } from '../../utils/query';
import { CASE_INSENSITIVE } from '../roles/role.model';
import { RoomModel } from '../rooms/room.model';
import { RoomTypeModel } from './room-type.model';

type LeanRoomType = LeanBase & {
  hotelId: Types.ObjectId;
  name: string;
  code: string;
  pmsCode: string | null;
  cleaningMinutes: number | null;
};

/** "Deluxe Room" → "DLX": the word "room" says nothing. */
const FILLER = new Set(['ROOM', 'ROOMS', 'THE', 'AND', 'OF']);
export const roomTypeCodeFromName = (name: string) => codeFromName(name, FILLER);

const toDto = (t: LeanRoomType, roomCount: number): RoomType => ({
  ...toBaseDto(t),
  hotelId: String(t.hotelId),
  name: t.name,
  code: t.code,
  pmsCode: t.pmsCode ?? null,
  cleaningMinutes: t.cleaningMinutes ?? null,
  roomCount,
});

/** Non-deleted rooms per room type. */
async function countRooms(typeIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await RoomModel.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { roomTypeId: { $in: typeIds }, isDeleted: false } },
    { $group: { _id: '$roomTypeId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function findOrThrow(hotelId: string, id: string): Promise<LeanRoomType> {
  const type = await RoomTypeModel.findOne({ _id: id, hotelId }).lean<LeanRoomType>();
  if (!type) throw AppError.notFound('Room type not found');
  return type;
}

const hasRooms = (id: string) => RoomModel.exists({ roomTypeId: id }).then(Boolean);
const inUse = () =>
  AppError.conflict('ROOM_TYPE_IN_USE', 'This room type has rooms; move or delete them first');

async function assertNameFree(hotelId: string, name: string, exceptId?: string) {
  const clash = await RoomTypeModel.findOne({
    hotelId,
    name,
    ...(exceptId && { _id: { $ne: exceptId } }),
  })
    .collation(CASE_INSENSITIVE)
    .select('_id')
    .lean();
  if (clash) {
    throw AppError.conflict('NAME_TAKEN', 'This hotel already has a room type with this name');
  }
}

export const roomTypeService = {
  async list(hotelId: string, query: RoomTypeListQuery): Promise<Paginated<RoomType>> {
    const { page, limit, q, isActive, sort } = query;
    const filter: Record<string, unknown> = { hotelId };
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { pmsCode: rx }];
    }

    const [items, total] = await Promise.all([
      RoomTypeModel.find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanRoomType[]>(),
      RoomTypeModel.countDocuments(filter),
    ]);
    const counts = await countRooms(items.map((t) => t._id));
    return {
      items: items.map((t) => toDto(t, counts.get(String(t._id)) ?? 0)),
      page,
      limit,
      total,
    };
  },

  async getById(hotelId: string, id: string): Promise<RoomType> {
    const type = await findOrThrow(hotelId, id);
    const counts = await countRooms([type._id]);
    return toDto(type, counts.get(id) ?? 0);
  },

  async create(hotelId: string, input: CreateRoomTypeInput, actorId: string): Promise<RoomType> {
    await assertNameFree(hotelId, input.name);
    const code = await firstFreeCode(roomTypeCodeFromName(input.name), (c) =>
      RoomTypeModel.exists({ hotelId, code: c }),
    );
    const type = await RoomTypeModel.create({
      ...input,
      hotelId,
      code,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(hotelId, String(type._id));
  },

  async update(
    hotelId: string,
    id: string,
    input: UpdateRoomTypeInput,
    actorId: string,
  ): Promise<RoomType> {
    const type = await findOrThrow(hotelId, id);
    if (input.name !== undefined && input.name !== type.name) {
      await assertNameFree(hotelId, input.name, id);
    }
    if (input.isActive === false && type.isActive && (await hasRooms(id))) throw inUse();

    await RoomTypeModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(hotelId, id);
  },

  async remove(hotelId: string, id: string, actorId: string): Promise<void> {
    await findOrThrow(hotelId, id);
    if (await hasRooms(id)) throw inUse();
    await RoomTypeModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },
};
