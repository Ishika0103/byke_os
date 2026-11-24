import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * consumptionmodulemasters (Plan 12 §3.1): F&B, Engineering, Housekeeping, Electricity, Water, Fuel.
 * Seeded by migration only. Not the `departments` collection.
 * Indexes (migration): name unique ignoring case, code unique (both partial on isDeleted: false).
 */
const consumptionModuleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'consumptionmodulemasters' },
);

consumptionModuleSchema.plugin(baseFieldsPlugin);

export const ConsumptionModuleModel = model('ConsumptionModule', consumptionModuleSchema);
