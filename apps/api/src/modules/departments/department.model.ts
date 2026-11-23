import { Schema, model } from 'mongoose';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * departments (Plan 09 §6). Global, not per hotel. Indexes live in migrations:
 *   name unique case-insensitive, code unique (both partial isDeleted:false).
 */
const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    code: { type: String, required: true, trim: true, uppercase: true, immutable: true },
  },
  { timestamps: true, collection: 'departments' },
);

departmentSchema.plugin(baseFieldsPlugin);

export const DepartmentModel = model('Department', departmentSchema);
