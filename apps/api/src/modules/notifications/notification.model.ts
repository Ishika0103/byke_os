import { Schema, model } from 'mongoose';
import { NOTIFICATION_KINDS } from '@byke-os/shared';
import { baseFieldsPlugin } from '../../db/plugins/base-fields.plugin';

/**
 * notifications (Plan 09 §8): one row per recipient. Indexes live in migrations:
 *   { userId, readAt, createdAt:-1 } and unique partial { userId, dedupeKey } (string dedupeKey).
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    hotelId: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, immutable: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 1000, default: null },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, default: undefined },
  },
  { timestamps: true, collection: 'notifications', autoIndex: false },
);

notificationSchema.plugin(baseFieldsPlugin);

export const NotificationModel = model('Notification', notificationSchema);
