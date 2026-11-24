import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * roomTypes (Plan 03 §2). Indexes live in migrations:
 *   { hotelId, code } unique, { hotelId, name } unique case-insensitive (both partial isDeleted:false).
 * The number of rooms is not stored: it is counted from `rooms`.
 */
const roomTypeSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    code: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    pmsCode: { type: String, trim: true, uppercase: true, default: null },
    cleaningMinutes: { type: Number, min: 5, max: 240, default: null },
  },
  { timestamps: true, collection: 'roomtypes' },
);

roomTypeSchema.plugin(baseFieldsPlugin);

export const RoomTypeModel = model('RoomType', roomTypeSchema);
