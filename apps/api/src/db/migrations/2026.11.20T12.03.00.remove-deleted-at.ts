import type { Migration } from '../migrator';

/**
 * Drops the `deletedAt` field (decision 2026-11-20): a soft delete is recorded by
 * `isDeleted: true` plus `updatedAt` (when) and `updatedBy` (who).
 */
const COLLECTIONS = ['users', 'roles'];

export const up: Migration = async ({ context: { db } }) => {
  for (const name of COLLECTIONS) {
    await db
      .collection(name)
      .updateMany({ deletedAt: { $exists: true } }, { $unset: { deletedAt: '' } });
  }
};

export const down: Migration = async ({ context: { db } }) => {
  // Best effort: the original delete time is gone; updatedAt is the closest value.
  for (const name of COLLECTIONS) {
    const coll = db.collection(name);
    await coll.updateMany({ isDeleted: false }, { $set: { deletedAt: null } });
    await coll.updateMany({ isDeleted: true }, [{ $set: { deletedAt: '$updatedAt' } }]);
  }
};
