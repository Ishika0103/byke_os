import { Schema, model } from 'mongoose';
import { TASK_MASTER_TYPES } from '@byke-os/shared';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * taskmasters (Plan 09 §7): predefined task titles. Seeded by migration only.
 * Index (migration): title unique ignoring case (partial on isDeleted: false).
 */
const taskMasterSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    type: { type: String, enum: TASK_MASTER_TYPES, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
  },
  { timestamps: true, collection: 'taskmasters' },
);

taskMasterSchema.plugin(baseFieldsPlugin);

export const TaskMasterModel = model('TaskMaster', taskMasterSchema);
