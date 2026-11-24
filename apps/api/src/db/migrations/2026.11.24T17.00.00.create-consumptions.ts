import type { Migration } from '../migrator';

/** Plan 12 §3.2: one row per property, date, module and type (issue / consumption). */
export const up: Migration = async ({ context: { db } }) => {
  const consumptions = db.collection('consumptions');
  // This index is what turns "same property, date, module, type again" into an update.
  await consumptions.createIndex(
    { hotelId: 1, date: 1, module: 1, type: 1 },
    {
      name: 'hotel_date_module_type_unique',
      unique: true,
      partialFilterExpression: { isDeleted: false },
    },
  );
  await consumptions.createIndex({ date: -1, hotelId: 1 }, { name: 'date_hotel' });
};

export const down: Migration = async ({ context: { db } }) => {
  await db.collection('consumptions').drop();
};
