import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

/** Plan 02 §2: hotel code unique, name unique (case-insensitive), lookup by city. */
export const up: Migration = async ({ context: { db } }) => {
  const hotels = db.collection('hotels');
  await hotels.createIndex(
    { code: 1 },
    { name: 'code_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );
  await hotels.createIndex(
    { name: 1 },
    {
      name: 'name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );
  await hotels.createIndex({ 'location.city': 1 }, { name: 'location_city' });
};

export const down: Migration = async ({ context: { db } }) => {
  const hotels = db.collection('hotels');
  await hotels.dropIndex('code_unique');
  await hotels.dropIndex('name_unique_ci');
  await hotels.dropIndex('location_city');
};
