import { Schema, model, type InferSchemaType } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * hotels (Plan 02 §2). Indexes live in migrations:
 *   code unique, name unique case-insensitive (both partial isDeleted:false), locationId.
 */
const hotelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    code: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    checkInTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    checkOutTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { timestamps: true, collection: 'hotels' },
);

hotelSchema.plugin(baseFieldsPlugin);

export type HotelFields = InferSchemaType<typeof hotelSchema>;
export const HotelModel = model('Hotel', hotelSchema);
