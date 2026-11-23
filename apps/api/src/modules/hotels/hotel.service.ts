import type { Types } from 'mongoose';
import type {
  CreateHotelInput,
  Hotel,
  HotelListQuery,
  LocationSummary,
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
import { LocationModel } from '../locations/location.model';
import { UserModel } from '../users/user.model';
import { HotelModel } from './hotel.model';

type LeanHotel = LeanBase & {
  name: string;
  code: string;
  locationId: Types.ObjectId;
  checkInTime: string;
  checkOutTime: string;
};

const toHotelDto = (h: LeanHotel, location: LocationSummary): Hotel => ({
  ...toBaseDto(h),
  name: h.name,
  code: h.code,
  location,
  checkInTime: h.checkInTime,
  checkOutTime: h.checkOutTime,
});

/** Looks up the location of each hotel on a page (blank if it can't be found). */
async function locationsFor(hotels: LeanHotel[]) {
  const ids = [...new Set(hotels.map((h) => String(h.locationId)))];
  const found = await LocationModel.find({ _id: { $in: ids } }).lean<
    { _id: Types.ObjectId; name: string; state: string }[]
  >();
  const byId = new Map(found.map((l) => [String(l._id), l]));
  return (h: LeanHotel): LocationSummary => {
    const l = byId.get(String(h.locationId));
    return { id: String(h.locationId), name: l?.name ?? '', state: l?.state ?? '' };
  };
}

/** The location must exist and be active. */
async function assertLocation(locationId: string) {
  if (!(await LocationModel.exists({ _id: locationId, isActive: true }))) {
    throw AppError.field('locationId', 'Pick a location from the list');
  }
}

/** Hotels the user may see (Plan 05); null = all. */
export type HotelScope = string[] | null;

const inScope = (scope: HotelScope) => (scope === null ? {} : { _id: { $in: scope } });

async function findOrThrow(id: string, scope: HotelScope = null): Promise<LeanHotel> {
  if (scope !== null && !scope.includes(id)) throw AppError.notFound('Hotel not found');
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
  async list(query: HotelListQuery, scope: HotelScope): Promise<Paginated<Hotel>> {
    const { page, limit, q, isActive, sort, locationId } = query;
    const filter: Record<string, unknown> = { ...inScope(scope) };
    if (isActive !== undefined) filter.isActive = isActive;
    if (locationId) filter.locationId = locationId;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      const near = await LocationModel.find({ $or: [{ name: rx }, { state: rx }] })
        .select('_id')
        .lean();
      filter.$or = [{ name: rx }, { code: rx }, { locationId: { $in: near.map((l) => l._id) } }];
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
    const locationOf = await locationsFor(items);
    return { items: items.map((h) => toHotelDto(h, locationOf(h))), page, limit, total };
  },

  async getById(id: string, scope: HotelScope = null): Promise<Hotel> {
    const hotel = await findOrThrow(id, scope);
    return toHotelDto(hotel, (await locationsFor([hotel]))(hotel));
  },

  async create(input: CreateHotelInput, actorId: string | null): Promise<Hotel> {
    await assertNameFree(input.name);
    await assertLocation(input.locationId);
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

  async update(
    id: string,
    input: UpdateHotelInput,
    actorId: string,
    scope: HotelScope,
  ): Promise<Hotel> {
    const hotel = await findOrThrow(id, scope);
    if (input.name !== undefined && input.name !== hotel.name) await assertNameFree(input.name, id);
    if (input.locationId && input.locationId !== String(hotel.locationId)) {
      await assertLocation(input.locationId);
    }

    await HotelModel.updateOne(
      { _id: id },
      { ...input, updatedBy: actorId },
      { runValidators: true },
    );
    return this.getById(id);
  },

  async remove(id: string, actorId: string, scope: HotelScope): Promise<void> {
    await findOrThrow(id, scope);
    if (await UserModel.exists({ hotelIds: id })) {
      throw AppError.conflict(
        'HOTEL_IN_USE',
        "Users are still added to this hotel, so it can't be deleted. Remove them first or make it inactive",
      );
    }
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
