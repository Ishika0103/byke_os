import type { Migration } from '../migrator';

/** Plan 05: users.hotelIds (hotels a user works at), backfilled empty, indexed. */
export const up: Migration = async ({ context: { db } }) => {
  const users = db.collection('users');
  await users.updateMany({ hotelIds: { $exists: false } }, { $set: { hotelIds: [] } });
  await users.createIndex({ hotelIds: 1 }, { name: 'hotelIds_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  const users = db.collection('users');
  await users.dropIndex('hotelIds_1');
  await users.updateMany({}, { $unset: { hotelIds: '' } });
};
