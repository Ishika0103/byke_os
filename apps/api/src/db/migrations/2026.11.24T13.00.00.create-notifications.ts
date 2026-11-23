import type { Migration } from '../migrator';

/** Plan 09 §8: in-app notifications. */
export const up: Migration = async ({ context: { db } }) => {
  const notifications = db.collection('notifications');
  await notifications.createIndex(
    { userId: 1, readAt: 1, createdAt: -1 },
    { name: 'user_read_createdAt' },
  );
  // One notification per user per dedupeKey (e.g. "overdue:<taskId>").
  await notifications.createIndex(
    { userId: 1, dedupeKey: 1 },
    {
      name: 'user_dedupe_unique',
      unique: true,
      partialFilterExpression: { dedupeKey: { $type: 'string' } },
    },
  );
};

export const down: Migration = async ({ context: { db } }) => {
  await db
    .collection('notifications')
    .drop()
    .catch(() => undefined);
};
