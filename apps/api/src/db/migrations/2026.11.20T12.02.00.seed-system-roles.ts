import type { Migration } from '../migrator';

// Frozen copy: migrations must not import app code that may change later.
const SYSTEM_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
  { code: 'HO', name: 'Head Office' },
  { code: 'GM', name: 'General Manager' },
  { code: 'HOD', name: 'Head of Department' },
  { code: 'STAFF', name: 'Staff' },
];

export const up: Migration = async ({ context: { db } }) => {
  const now = new Date();
  // Upsert by code, so re-running never duplicates and never overwrites admin edits.
  await db.collection('roles').bulkWrite(
    SYSTEM_ROLES.map((role) => ({
      updateOne: {
        filter: { code: role.code, isDeleted: false },
        update: {
          $setOnInsert: {
            ...role,
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdBy: null,
            updatedBy: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );
};

export const down: Migration = async ({ context: { db } }) => {
  const codes = SYSTEM_ROLES.map((r) => r.code);
  const roles = await db
    .collection('roles')
    .find({ code: { $in: codes }, createdBy: null })
    .project({ _id: 1 })
    .toArray();
  const inUse = await db
    .collection('users')
    .countDocuments({ roleId: { $in: roles.map((r) => r._id) }, isDeleted: false });
  if (inUse > 0) {
    throw new Error(`Cannot remove system roles: ${inUse} user(s) still assigned to them`);
  }
  await db.collection('roles').deleteMany({ _id: { $in: roles.map((r) => r._id) } });
};
