import { Schema, model } from 'mongoose';
import { TASK_STAGES, TASK_UPDATE_KINDS } from '@byke-os/shared';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * tasks (Plan 04 §2.1): the current state of one task. Indexes live in migrations:
 *   { hotelId, stage, dueAt }, { hotelId, departmentId, stage }, { groupId }, { hotelId, assigneeIds, stage }, { roomId }.
 */
const taskSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: null },
    taskMasterId: { type: Schema.Types.ObjectId, ref: 'TaskMaster', default: null },
    /** Tasks created together (one per room) share a group id. */
    groupId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
    assigneeIds: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    dueAt: { type: Date, required: true },
    stage: { type: String, enum: TASK_STAGES, required: true, default: 'pending' },
    blockedFrom: { type: String, enum: [...TASK_STAGES, null], default: null },
    blockedReason: { type: String, default: null },
    doneBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    doneAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'tasks' },
);

taskSchema.plugin(baseFieldsPlugin);

export const TaskModel = model('Task', taskSchema);

/**
 * taskUpdates (Plan 04 §2.2): the log. Rows are only ever added, never edited or deleted.
 * isActive / isDeleted come from the base plugin for the collection convention and never change.
 * Index (migration): { taskId, createdAt }.
 */
const taskUpdateSchema = new Schema(
  {
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, immutable: true },
    kind: { type: String, enum: TASK_UPDATE_KINDS, required: true, immutable: true },
    fromStage: { type: String, enum: [...TASK_STAGES, null], default: null, immutable: true },
    toStage: { type: String, enum: [...TASK_STAGES, null], default: null, immutable: true },
    note: { type: String, default: null, immutable: true },
    photos: { type: [{ url: String, _id: false }], default: [], immutable: true },
    changes: { type: Schema.Types.Mixed, default: null, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'taskUpdates' },
);

taskUpdateSchema.plugin(baseFieldsPlugin);

export const TaskUpdateModel = model('TaskUpdate', taskUpdateSchema);
