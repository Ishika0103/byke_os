import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * users (Plan 01a §2.2). Indexes live in migrations:
 *   email unique (partial isDeleted:false), roleId.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    // bcrypt hash. Never returned: excluded from queries and from JSON output.
    hashPassword: { type: String, required: true, select: false },
  },
  { timestamps: true, collection: 'users' },
);

// Defence in depth: strip the hash from JSON even if a query explicitly selected it.
userSchema.plugin(baseFieldsPlugin, { hiddenFields: ['hashPassword'] });

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserFields>;
export const UserModel = model('User', userSchema);
