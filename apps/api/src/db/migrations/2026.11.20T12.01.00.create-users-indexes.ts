import type { Migration } from '../migrator';

export const up: Migration = async ({ context: { db } }) => {
  const users = db.collection('users');
  await users.createIndex(
    { email: 1 },
    { name: 'email_unique', unique: true, partialFilterExpression: { isDeleted: false } },
  );
  await users.createIndex({ roleId: 1 }, { name: 'roleId_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  const users = db.collection('users');
  await users.dropIndex('email_unique');
  await users.dropIndex('roleId_1');
};
