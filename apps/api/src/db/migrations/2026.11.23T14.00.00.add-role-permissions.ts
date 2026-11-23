import type { Migration } from '../migrator';

/**
 * Plan 06: roles.permissions. Super Admin holds everything ('*'); every other role starts with
 * none, and Super Admin sets them in the app.
 */
export const up: Migration = async ({ context: { db } }) => {
  const roles = db.collection('roles');
  await roles.updateMany({ code: 'SUPER_ADMIN' }, { $set: { permissions: ['*'] } });
  await roles.updateMany(
    { code: { $ne: 'SUPER_ADMIN' }, permissions: { $exists: false } },
    { $set: { permissions: [] } },
  );
};

export const down: Migration = async ({ context: { db } }) => {
  await db.collection('roles').updateMany({}, { $unset: { permissions: '' } });
};
