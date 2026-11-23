import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * locations (Plan 08). Filled by a migration; no screens yet.
 * Indexes live in migrations: name unique case-insensitive, slug unique (both partial).
 */
const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    state: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    bykeId: { type: Number, default: null },
  },
  { timestamps: true, collection: 'locations' },
);

locationSchema.plugin(baseFieldsPlugin);

export const LocationModel = model('Location', locationSchema);
