import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

/** Plan 03 §2: room types and rooms, unique per hotel. */
export const up: Migration = async ({ context: { db } }) => {
  const roomTypes = db.collection('roomTypes');
  await roomTypes.createIndex(
    { hotelId: 1, code: 1 },
    { name: 'hotel_code_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );
  await roomTypes.createIndex(
    { hotelId: 1, name: 1 },
    {
      name: 'hotel_name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );

  const rooms = db.collection('rooms');
  await rooms.createIndex(
    { hotelId: 1, roomNumber: 1 },
    { name: 'hotel_roomNumber_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );
  await rooms.createIndex({ roomTypeId: 1 }, { name: 'roomTypeId_1' });
  await rooms.createIndex({ hotelId: 1, floor: 1 }, { name: 'hotel_floor' });
};

export const down: Migration = async ({ context: { db } }) => {
  const roomTypes = db.collection('roomTypes');
  await roomTypes.dropIndex('hotel_code_unique');
  await roomTypes.dropIndex('hotel_name_unique_ci');
  const rooms = db.collection('rooms');
  await rooms.dropIndex('hotel_roomNumber_unique');
  await rooms.dropIndex('roomTypeId_1');
  await rooms.dropIndex('hotel_floor');
};
