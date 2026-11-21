import type { Migration } from '../migrator';

/** Plan 04 §2.4: tasks and their log. */
export const up: Migration = async ({ context: { db } }) => {
  const tasks = db.collection('tasks');
  await tasks.createIndex({ hotelId: 1, stage: 1, dueAt: 1 }, { name: 'hotel_stage_due' });
  await tasks.createIndex(
    { hotelId: 1, assigneeId: 1, stage: 1 },
    { name: 'hotel_assignee_stage' },
  );
  await tasks.createIndex({ roomId: 1 }, { name: 'roomId_1' });

  await db
    .collection('taskUpdates')
    .createIndex({ taskId: 1, createdAt: 1 }, { name: 'task_createdAt' });
};

export const down: Migration = async ({ context: { db } }) => {
  const tasks = db.collection('tasks');
  await tasks.dropIndex('hotel_stage_due');
  await tasks.dropIndex('hotel_assignee_stage');
  await tasks.dropIndex('roomId_1');
  await db.collection('taskUpdates').dropIndex('task_createdAt');
};
