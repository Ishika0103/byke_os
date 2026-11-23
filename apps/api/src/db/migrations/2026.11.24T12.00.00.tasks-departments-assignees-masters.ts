import type { Migration } from '../migrator';

/** Plan 09 §7 / §7a: task masters, and tasks move to departmentId, assigneeIds[], groupId. */

const CI = { locale: 'en', strength: 2 } as const;

/** Old fixed department keys -> names of the seeded departments. */
const KEY_TO_NAME: Record<string, string> = {
  housekeeping: 'Housekeeping',
  front_office: 'Front Office',
  maintenance: 'Maintenance',
};

const MASTERS = [
  { title: 'Room Cleaning', type: 'service', department: 'Housekeeping' },
  { title: 'Guest Complaint', type: 'complaint', department: 'Front Office' },
  { title: 'Food Order', type: 'order', department: 'Food & Beverage' },
  { title: 'Maintenance Request', type: 'request', department: 'Maintenance' },
  { title: 'Laundry', type: 'service', department: 'Housekeeping' },
];

export const up: Migration = async ({ context: { db } }) => {
  const departments = db.collection('departments');
  const taskMasters = db.collection('taskMasters');
  const tasks = db.collection('tasks');

  const departmentId = async (name: string) => {
    const d = await departments.findOne({ name, isDeleted: false }, { collation: CI });
    if (!d) throw new Error(`Department "${name}" not found (run the departments migration first)`);
    return d._id;
  };

  await taskMasters.createIndex(
    { title: 1 },
    {
      name: 'title_unique_ci',
      unique: true,
      partialFilterExpression: { isDeleted: false },
      collation: CI,
    },
  );
  const now = new Date();
  for (const m of MASTERS) {
    await taskMasters.updateOne(
      { title: m.title, isDeleted: false },
      {
        $setOnInsert: {
          title: m.title,
          type: m.type,
          departmentId: await departmentId(m.department),
          isActive: true,
          isDeleted: false,
          createdBy: null,
          updatedBy: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, collation: CI },
    );
  }

  // Existing tasks: department key -> departmentId.
  for (const [key, name] of Object.entries(KEY_TO_NAME)) {
    await tasks.updateMany({ department: key }, [
      { $set: { departmentId: await departmentId(name) } },
      { $unset: 'department' },
    ]);
  }
  // assigneeId -> assigneeIds, each old task is its own group, no master.
  await tasks.updateMany({ assigneeIds: { $exists: false } }, [
    {
      $set: {
        assigneeIds: { $cond: [{ $ifNull: ['$assigneeId', false] }, ['$assigneeId'], []] },
        groupId: '$_id',
        taskMasterId: null,
      },
    },
    { $unset: 'assigneeId' },
  ]);

  await tasks.dropIndex('hotel_assignee_stage').catch(() => undefined);
  await tasks.createIndex(
    { hotelId: 1, assigneeIds: 1, stage: 1 },
    { name: 'hotel_assignees_stage' },
  );
  await tasks.createIndex(
    { hotelId: 1, departmentId: 1, stage: 1 },
    { name: 'hotel_department_stage' },
  );
  await tasks.createIndex({ groupId: 1 }, { name: 'groupId_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  const departments = db.collection('departments');
  const tasks = db.collection('tasks');

  // Back to a department key (a department outside the old three becomes housekeeping) and
  // the first assignee only.
  const keyById = new Map<string, string>();
  for (const [key, name] of Object.entries(KEY_TO_NAME)) {
    const d = await departments.findOne({ name }, { collation: CI });
    if (d) keyById.set(String(d._id), key);
  }
  for await (const t of tasks.find({ departmentId: { $exists: true } })) {
    await tasks.updateOne(
      { _id: t._id },
      {
        $set: {
          department: keyById.get(String(t.departmentId)) ?? 'housekeeping',
          assigneeId: (t.assigneeIds as unknown[] | undefined)?.[0] ?? null,
        },
        $unset: { departmentId: '', assigneeIds: '', groupId: '', taskMasterId: '' },
      },
    );
  }

  await tasks.dropIndex('hotel_assignees_stage').catch(() => undefined);
  await tasks.dropIndex('hotel_department_stage').catch(() => undefined);
  await tasks.dropIndex('groupId_1').catch(() => undefined);
  await tasks.createIndex(
    { hotelId: 1, assigneeId: 1, stage: 1 },
    { name: 'hotel_assignee_stage' },
  );
  await db
    .collection('taskMasters')
    .drop()
    .catch(() => undefined);
};
