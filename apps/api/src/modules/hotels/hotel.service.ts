import type {
  CreateHotelInput,
  Hotel,
  HotelListQuery,
  Paginated,
  UpdateHotelInput,
} from '@byke-os/shared';
import { type LeanBase, softDeleteUpdate, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { codeFromName, firstFreeCode } from '../../utils/code';
import { escapeRegex, toSort } from '../../utils/query';
import { CASE_INSENSITIVE } from '../roles/role.model';
import { RoomTypeModel } from '../room-types/room-type.model';
import { RoomModel } from '../rooms/room.model';
import { TaskModel } from '../tasks/task.model';
import { HotelModel } from './hotel.model';

type LeanHotel = LeanBase & {
  name: string;
  code: string;
  location: { city: string; state: string };
  checkInTime: string;
  checkOutTime: string;
};

const toHotelDto = (h: LeanHotel): Hotel => ({
  ...toBaseDto(h),
  name: h.name,
  code: h.code,
  location: { city: h.location.city, state: h.location.state },
  checkInTime: h.checkInTime,
  checkOutTime: h.checkOutTime,
});

async function findOrThrow(id: string): Promise<LeanHotel> {
  const hotel = await HotelModel.findById(id).lean<LeanHotel>();
  if (!hotel) throw AppError.notFound('Hotel not found');
  return hotel;
}

/** Words left out of generated codes: they appear in most Byke hotel names. */
const FILLER = new Set(['THE', 'BYKE', 'HOTEL', 'HOTELS', 'RESORT', 'RESORTS', 'AND', 'OF']);

/** Hotel code from its name, e.g. "The Byke Brightland Resort" → "BRG". */
export const hotelCodeFromName = (name: string) => codeFromName(name, FILLER);

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await HotelModel.findOne({ name, ...(exceptId && { _id: { $ne: exceptId } }) })
    .collation(CASE_INSENSITIVE)
    .select('_id')
    .lean();
  if (clash) throw AppError.conflict('NAME_TAKEN', 'A hotel with this name already exists');
}

export const hotelService = {
  async list(query: HotelListQuery): Promise<Paginated<Hotel>> {
    const { page, limit, q, isActive, sort } = query;
    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { 'location.city': rx }, { 'location.state': rx }];
    }

    const [items, total] = await Promise.all([
      HotelModel.find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(toSort(sort))
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeanHotel[]>(),
      HotelModel.countDocuments(filter),
    ]);
    return { items: items.map(toHotelDto), page, limit, total };
  },

  async getById(id: string): Promise<Hotel> {
    return toHotelDto(await findOrThrow(id));
  },

  async create(input: CreateHotelInput, actorId: string | null): Promise<Hotel> {
    await assertNameFree(input.name);
    const code = await firstFreeCode(hotelCodeFromName(input.name), (c) =>
      HotelModel.exists({ code: c }),
    );

    const hotel = await HotelModel.create({
      ...input,
      code,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.getById(String(hotel._id));
  },

  async update(id: string, input: UpdateHotelInput, actorId: string): Promise<Hotel> {
    const hotel = await findOrThrow(id);
    if (input.name !== undefined && input.name !== hotel.name) await assertNameFree(input.name, id);

    await HotelModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(id);
  },

  async remove(id: string, actorId: string): Promise<void> {
    await findOrThrow(id);
    const [types, rooms, tasks] = await Promise.all([
      RoomTypeModel.exists({ hotelId: id }),
      RoomModel.exists({ hotelId: id }),
      TaskModel.exists({ hotelId: id }),
    ]);
    if (types || rooms || tasks) {
      throw AppError.conflict(
        'HOTEL_IN_USE',
        "This hotel has room types, rooms or tasks, so it can't be deleted. Make it inactive instead",
      );
    }
    await HotelModel.updateOne({ _id: id }, softDeleteUpdate(actorId));
  },
};
