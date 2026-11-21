import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

export const up: Migration = async ({ context: { db } }) => {
  const roles = db.collection('roles');
  await roles.createIndex(
    { code: 1 },
    { name: 'code_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );
  // Case-insensitive uniqueness: "General Manager" and "general manager" can't both exist.
  await roles.createIndex(
    { name: 1 },
    {
      name: 'name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );
};

export const down: Migration = async ({ context: { db } }) => {
  const roles = db.collection('roles');
  await roles.dropIndex('code_unique');
  await roles.dropIndex('name_unique_ci');
};
