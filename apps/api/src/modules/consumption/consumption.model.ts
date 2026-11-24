import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * Daily consumption (Plan 12): one collection per module, one document per property and date.
 * Indexes (migration): { hotelId, date, module } unique (partial isDeleted:false), { date: -1, hotelId }.
 */
const makeSchema = (collection: string) => {
  const schema = new Schema(
    {
      hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
      propertyCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
      // The calendar day as 00:00 UTC.
      date: { type: Date, required: true },
      // The module code (FB, ENG, HK); the collection already says it, this keeps rows self-describing.
      module: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
      // 0 = not marked, 1 = marked.
      isMarked: { type: Number, enum: [0, 1], required: true },
    },
    { timestamps: true, collection },
  );
  schema.plugin(baseFieldsPlugin);
  return schema;
};

/** Module code -> its own collection. A module not listed here has no collection yet. */
export const CONSUMPTION_COLLECTIONS = {
  FB: 'fnbdailyconsumptions',
  ENG: 'engineeringdailyconsumptions',
  HK: 'housekeepingdailyconsumptions',
} as const;

export type ConsumptionModuleCode = keyof typeof CONSUMPTION_COLLECTIONS;

export const ConsumptionModels = {
  FB: model('FnbDailyConsumption', makeSchema(CONSUMPTION_COLLECTIONS.FB)),
  ENG: model('EngineeringDailyConsumption', makeSchema(CONSUMPTION_COLLECTIONS.ENG)),
  HK: model('HousekeepingDailyConsumption', makeSchema(CONSUMPTION_COLLECTIONS.HK)),
} as const;

export const modelFor = (code: string) =>
  (ConsumptionModels as Record<string, (typeof ConsumptionModels)[ConsumptionModuleCode]>)[code];
