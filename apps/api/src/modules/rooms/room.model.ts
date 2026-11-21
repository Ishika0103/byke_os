import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * rooms (Plan 03 §2). Indexes live in migrations:
 *   { hotelId, roomNumber } unique (partial isDeleted:false), { roomTypeId }, { hotelId, floor }.
 */
const roomSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    roomTypeId: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true },
    roomNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    floor: { type: Number, min: -5, max: 200, default: null },
    isSellable: { type: Boolean, default: true },
    notes: { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true, collection: 'rooms' },
);

roomSchema.plugin(baseFieldsPlugin);

export const RoomModel = model('Room', roomSchema);

/** Sorts room numbers the way people expect: 2, 10, 101 (not 10, 101, 2). */
export const NATURAL_ORDER = { locale: 'en', numericOrdering: true, strength: 2 } as const;
