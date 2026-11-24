import type { Migration } from '../migrator';

/** Collection names are all lowercase: roomTypes -> roomtypes, taskUpdates -> taskupdates. */
const RENAMES: [from: string, to: string][] = [
  ['roomTypes', 'roomtypes'],
  ['taskUpdates', 'taskupdates'],
];

type Db = Parameters<Migration>[0]['context']['db'];

async function rename(db: Db, from: string, to: string) {
  const exists =
    (await db.listCollections({ name: from }, { nameOnly: true }).toArray()).length > 0;
  if (exists) await db.collection(from).rename(to);
}

export const up: Migration = async ({ context: { db } }) => {
  for (const [from, to] of RENAMES) await rename(db, from, to);
};
export const down: Migration = async ({ context: { db } }) => {
  for (const [from, to] of RENAMES) await rename(db, to, from);
};
