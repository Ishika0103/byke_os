import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

/** Plan 09 §6: the four departments every hotel starts with. Codes are fixed here. */
const SEED = [
  { name: 'Housekeeping', code: 'HK' },
  { name: 'Front Office', code: 'FO' },
  { name: 'Maintenance', code: 'MT' },
  { name: 'Food & Beverage', code: 'FB' },
];

export const up: Migration = async ({ context: { db } }) => {
  const departments = db.collection('departments');
  await departments.createIndex(
    { name: 1 },
    {
      name: 'name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );
  await departments.createIndex(
    { code: 1 },
    { name: 'code_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );

  const now = new Date();
  for (const d of SEED) {
    await departments.updateOne(
      { code: d.code, isDeleted: false },
      {
        $setOnInsert: {
          name: d.name,
          code: d.code,
          isActive: true,
          isDeleted: false,
          createdBy: null,
          updatedBy: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  await db.collection('users').createIndex({ departmentIds: 1 }, { name: 'departmentIds_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  await db
    .collection('users')
    .dropIndex('departmentIds_1')
    .catch(() => undefined);
  await db.collection('departments').drop();
};
