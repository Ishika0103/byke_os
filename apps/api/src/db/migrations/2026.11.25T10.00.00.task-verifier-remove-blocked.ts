import type { Migration } from '../migrator';

/** Plan 12: tasks get a verifier (backfilled with the creator); the blocked stage is removed. */

export const up: Migration = async ({ context: { db } }) => {
  const tasks = db.collection('tasks');

  await tasks.updateMany({ verifierId: { $exists: false } }, [
    { $set: { verifierId: '$createdBy' } },
  ]);
  await tasks.createIndex(
    { hotelId: 1, verifierId: 1, stage: 1 },
    { name: 'hotel_verifier_stage' },
  );

  // Blocked tasks go back to the stage they were blocked from (else pending).
  await tasks.updateMany({ stage: 'blocked' }, [
    { $set: { stage: { $ifNull: ['$blockedFrom', 'pending'] } } },
  ]);
  await tasks.updateMany(
    { $or: [{ blockedFrom: { $exists: true } }, { blockedReason: { $exists: true } }] },
    { $unset: { blockedFrom: '', blockedReason: '' } },
  );
};

export const down: Migration = async ({ context: { db } }) => {
  // The old blocked state can't be recovered; only the verifier part is undone.
  const tasks = db.collection('tasks');
  await tasks.dropIndex('hotel_verifier_stage').catch(() => undefined);
  await tasks.updateMany({}, { $unset: { verifierId: '' } });
};
