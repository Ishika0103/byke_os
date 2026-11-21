import { Schema, type Query } from 'mongoose';

/**
 * Common fields for every business collection (Plan 01a §1):
 * isActive, isDeleted, createdBy, updatedBy (+ timestamps set per schema).
 * A soft delete sets isDeleted: true; updatedAt / updatedBy record when and by whom.
 *
 * - Queries exclude soft-deleted documents unless the filter mentions `isDeleted` explicitly.
 * - JSON output exposes `id` instead of `_id` and hides `__v` and `isDeleted`.
 * - createdBy / updatedBy are set by services from the logged-in user (req.auth.userId).
 */
export type BaseFieldsOptions = {
  /** Extra fields never included in JSON output (e.g. password hashes). */
  hiddenFields?: string[];
};

export function baseFieldsPlugin(schema: Schema, options: BaseFieldsOptions = {}) {
  const hidden = ['isDeleted', ...(options.hiddenFields ?? [])];

  schema.add({
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  });

  function excludeDeleted(this: Query<unknown, unknown>) {
    if (!('isDeleted' in this.getFilter())) this.where({ isDeleted: false });
  }

  for (const op of [
    'find',
    'findOne',
    'countDocuments',
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
  ] as const) {
    schema.pre(op, excludeDeleted);
  }

  schema.set('toJSON', {
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      for (const key of hidden) delete ret[key];
      for (const key of ['createdBy', 'updatedBy']) {
        ret[key] = ret[key] ? String(ret[key]) : null;
      }
      return ret;
    },
  });
}
