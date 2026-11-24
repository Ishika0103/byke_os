import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * consumptions (Plan 12 §3.2): one document per property, date and module.
 * Indexes (migration): { hotelId, date, module } unique (partial isDeleted:false),
 * { date: -1, hotelId }.
 */
const consumptionSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    propertyCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    // The calendar day as 00:00 UTC.
    date: { type: Date, required: true },
    // The module code (FB, ENG, HK, ELEC, WATER, FUEL).
    module: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    // 0 = not marked, 1 = marked.
    isMarked: { type: Number, enum: [0, 1], required: true },
  },
  { timestamps: true, collection: 'consumptions' },
);

consumptionSchema.plugin(baseFieldsPlugin);

export const ConsumptionModel = model('Consumption', consumptionSchema);
