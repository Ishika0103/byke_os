import type { Migration } from '../migrator';

/**
 * Plan 12: only the sheet's Consumption column is used, so `type` goes away and a row is one
 * property + date + module. Rows made from the Issue column are removed.
 */
export const up: Migration = async ({ context: { db } }) => {
  const consumptions = db.collection('consumptions');
  await consumptions.deleteMany({ type: 'issue' });
  await consumptions.updateMany({}, { $unset: { type: '' } });
  const names = (await consumptions.indexes()).map((i) => i.name);
  if (names.includes('hotel_date_module_type_unique')) {
    await consumptions.dropIndex('hotel_date_module_type_unique');
  }
  await consumptions.createIndex(
    { hotelId: 1, date: 1, module: 1 },
    {
      name: 'hotel_date_module_unique',
      unique: true,
      partialFilterExpression: { isDeleted: false },
    },
  );
};

export const down: Migration = async ({ context: { db } }) => {
  const consumptions = db.collection('consumptions');
  await consumptions.dropIndex('hotel_date_module_unique');
  await consumptions.updateMany({}, { $set: { type: 'consumption' } });
  await consumptions.createIndex(
    { hotelId: 1, date: 1, module: 1, type: 1 },
    {
      name: 'hotel_date_module_type_unique',
      unique: true,
      partialFilterExpression: { isDeleted: false },
    },
  );
};
