import type { Migration } from '../migrator';

/** Collection name is all lowercase: taskMasters -> taskmasters (keeps data and indexes). */
async function rename(db: Parameters<Migration>[0]['context']['db'], from: string, to: string) {
  const exists =
    (await db.listCollections({ name: from }, { nameOnly: true }).toArray()).length > 0;
  if (exists) await db.collection(from).rename(to);
}

export const up: Migration = async ({ context: { db } }) =>
  rename(db, 'taskMasters', 'taskmasters');
export const down: Migration = async ({ context: { db } }) =>
  rename(db, 'taskmasters', 'taskMasters');
