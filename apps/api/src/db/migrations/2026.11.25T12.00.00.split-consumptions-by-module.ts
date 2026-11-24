import type { Migration } from '../migrator';

/**
 * Plan 12: each module keeps its own collection. Rows move from `consumptions` into
 * fnbdailyconsumptions / engineeringdailyconsumptions / housekeepingdailyconsumptions; rows of any
 * other module are not kept (there is no collection for them yet). `consumptions` is then dropped.
 */
const TARGETS: Record<string, string> = {
  FB: 'fnbdailyconsumptions',
  ENG: 'engineeringdailyconsumptions',
  HK: 'housekeepingdailyconsumptions',
};

export const up: Migration = async ({ context: { db } }) => {
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const [code, name] of Object.entries(TARGETS)) {
    const target = db.collection(name);
    await target.createIndex(
      { hotelId: 1, date: 1, module: 1 },
      {
        name: 'hotel_date_module_unique',
        unique: true,
        partialFilterExpression: { isDeleted: false },
      },
    );
    await target.createIndex({ date: -1, hotelId: 1 }, { name: 'date_hotel' });

    if (existing.has('consumptions')) {
      const rows = await db.collection('consumptions').find({ module: code }).toArray();
      for (let i = 0; i < rows.length; i += 1000) {
        await target.insertMany(rows.slice(i, i + 1000), { ordered: false });
      }
    }
  }

  if (existing.has('consumptions')) await db.collection('consumptions').drop();
};

export const down: Migration = async ({ context: { db } }) => {
  const consumptions = db.collection('consumptions');
  await consumptions.createIndex(
    { hotelId: 1, date: 1, module: 1 },
    {
      name: 'hotel_date_module_unique',
      unique: true,
      partialFilterExpression: { isDeleted: false },
    },
  );
  await consumptions.createIndex({ date: -1, hotelId: 1 }, { name: 'date_hotel' });
  for (const name of Object.values(TARGETS)) {
    const rows = await db.collection(name).find({}).toArray();
    if (rows.length) await consumptions.insertMany(rows, { ordered: false });
    await db.collection(name).drop();
  }
};
