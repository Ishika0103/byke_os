import { z } from 'zod';

/** Plan 09 §8: in-app notifications (no push). */
export const NOTIFICATION_KINDS = [
  'task_assigned',
  'task_started',
  'task_blocked',
  'task_done',
  'task_sent_back',
  'task_verified',
  'task_needs_verification',
  'task_overdue',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  taskId: string | null;
  hotelId: string;
  readAt: string | null;
  createdAt: string;
};

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
