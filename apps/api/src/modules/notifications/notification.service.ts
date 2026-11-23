import mongoose, { Types } from 'mongoose';
import {
  CLOSED_STAGES,
  type Notification,
  type NotificationKind,
  type NotificationListQuery,
  type Paginated,
} from '@byke-os/shared';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/app-error';
import { NotificationModel } from './notification.model';

type NotifyInput = {
  userIds: string[];
  hotelId: string;
  taskId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  dedupeKey?: string | null;
  /** The person who did the action: they don't get notified about their own action. */
  exceptUserId?: string | null;
};

function toDto(doc: {
  _id: unknown;
  kind: string;
  title: string;
  body?: string | null;
  taskId?: unknown;
  hotelId: unknown;
  readAt?: Date | null;
  createdAt: Date;
}): Notification {
  return {
    id: String(doc._id),
    kind: doc.kind as NotificationKind,
    title: doc.title,
    body: doc.body ?? null,
    taskId: doc.taskId ? String(doc.taskId) : null,
    hotelId: String(doc.hotelId),
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

const mine = (userId: string) => ({ userId: new Types.ObjectId(userId) });

export const notificationService = {
  /**
   * Adds one notification per distinct user. NEVER throws: a notification problem must not
   * break the action that caused it.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const except = input.exceptUserId ? String(input.exceptUserId) : null;
      const userIds = [...new Set((input.userIds ?? []).map(String))].filter(
        (id) => id !== except && Types.ObjectId.isValid(id),
      );
      const dedupeKey = input.dedupeKey ?? undefined;
      for (const userId of userIds) {
        try {
          await NotificationModel.create({
            userId,
            hotelId: input.hotelId,
            taskId: input.taskId ?? null,
            kind: input.kind,
            title: input.title,
            body: input.body ?? null,
            dedupeKey,
          });
        } catch (err) {
          // Same dedupeKey already sent to this user: fine.
          if ((err as { code?: number }).code === 11000) continue;
          logger.error({ err, userId, kind: input.kind }, 'Could not create notification');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Could not create notifications');
    }
  },

  /**
   * Notifies the assignees of every open task past its due time, once per task and person.
   * Reads tasks with the raw driver and handles both `assigneeIds` and the legacy `assigneeId`.
   */
  async notifyOverdueTasks(now = new Date()): Promise<void> {
    try {
      const tasks = await mongoose.connection
        .db!.collection('tasks')
        .find({
          dueAt: { $lt: now },
          isDeleted: { $ne: true },
          stage: { $nin: [...CLOSED_STAGES] },
        })
        .toArray();
      for (const t of tasks) {
        const ids: unknown[] = [
          ...(Array.isArray(t.assigneeIds) ? t.assigneeIds : []),
          ...(t.assigneeId ? [t.assigneeId] : []),
        ];
        if (ids.length === 0) continue;
        await notificationService.notify({
          userIds: ids.map(String),
          hotelId: String(t.hotelId),
          taskId: String(t._id),
          kind: 'task_overdue',
          title: `Task overdue: ${t.title}`,
          dedupeKey: `overdue:${String(t._id)}`,
        });
      }
    } catch (err) {
      logger.error({ err }, 'Overdue notification check failed');
    }
  },

  async list(userId: string, query: NotificationListQuery): Promise<Paginated<Notification>> {
    const { page, limit, unread } = query;
    const filter = { ...mine(userId), ...(unread ? { readAt: null } : {}) };
    const [items, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(filter),
    ]);
    return { items: items.map(toDto), page, limit, total };
  },

  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await NotificationModel.countDocuments({ ...mine(userId), readAt: null }) };
  },

  async markRead(userId: string, id: string): Promise<Notification> {
    const doc = await NotificationModel.findOneAndUpdate(
      { _id: id, ...mine(userId) },
      [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
      { new: true },
    ).lean();
    if (!doc) throw AppError.notFound('Notification not found');
    return toDto(doc);
  },

  async markAllRead(userId: string): Promise<{ count: number }> {
    const res = await NotificationModel.updateMany(
      { ...mine(userId), readAt: null },
      { readAt: new Date() },
    );
    return { count: res.modifiedCount };
  },
};
