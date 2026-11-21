import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * roles (Plan 01a §2.1). Indexes live in migrations:
 *   code unique (partial isDeleted:false), name unique case-insensitive (partial).
 */
const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    code: { type: String, required: true, trim: true, uppercase: true, immutable: true },
  },
  { timestamps: true, collection: 'roles' },
);

roleSchema.plugin(baseFieldsPlugin);

export type RoleFields = InferSchemaType<typeof roleSchema>;
export type RoleDocument = HydratedDocument<RoleFields>;
export const RoleModel = model('Role', roleSchema);

/** Collation used by the case-insensitive unique index on name. */
export const CASE_INSENSITIVE = { locale: 'en', strength: 2 } as const;
