import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

/** Plan 12 §3.1: the six consumption modules. Not departments. Codes are fixed here. */
const SEED = [
  { name: 'F&B', code: 'FB', sortOrder: 1 },
  { name: 'Engineering', code: 'ENG', sortOrder: 2 },
  { name: 'Housekeeping', code: 'HK', sortOrder: 3 },
  { name: 'Electricity', code: 'ELEC', sortOrder: 4 },
  { name: 'Water', code: 'WATER', sortOrder: 5 },
  { name: 'Fuel', code: 'FUEL', sortOrder: 6 },
];

export const up: Migration = async ({ context: { db } }) => {
  const masters = db.collection('consumptionmodulemasters');
  await masters.createIndex(
    { name: 1 },
    {
      name: 'name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );
  await masters.createIndex(
    { code: 1 },
    { name: 'code_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );

  const now = new Date();
  for (const m of SEED) {
    await masters.updateOne(
      { code: m.code, isDeleted: false },
      {
        $setOnInsert: {
          name: m.name,
          code: m.code,
          sortOrder: m.sortOrder,
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
};

export const down: Migration = async ({ context: { db } }) => {
  await db.collection('consumptionmodulemasters').drop();
};
