import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { roomTypeCodeFromName } from '../src/modules/room-types/room-type.service';
import { signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();

type Admin = Awaited<ReturnType<typeof signedInAs>>;

async function makeHotel(admin: Admin, name = 'Astara') {
  const res = await admin.post('/api/v1/hotels', {
    name,
    location: { city: 'Matheran', state: 'Maharashtra' },
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });
  return res.body.data.id as string;
}

async function makeType(admin: Admin, hotelId: string, body: object = {}) {
  const res = await admin.post(`/api/v1/hotels/${hotelId}/room-types`, {
    name: 'Deluxe Room',
    ...body,
  });
  return res;
}

describe('room types', () => {
  it('generates codes from the name', () => {
    expect(roomTypeCodeFromName('Deluxe Room')).toBe('DLX');
    expect(roomTypeCodeFromName('Premium Suite')).toBe('PS');
    expect(roomTypeCodeFromName('Super Deluxe Room')).toBe('SD');
    expect(roomTypeCodeFromName('Suite')).toBe('ST');
  });

  it('creates a room type with a generated code, PMS code and cleaning minutes', async () => {
    const admin = await signedInAs(app);
    const hotelId = await makeHotel(admin);
    const res = await makeType(admin, hotelId, { pmsCode: 'dlx-k', cleaningMinutes: 35 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      hotelId,
      name: 'Deluxe Room',
      code: 'DLX',
      pmsCode: 'DLX-K',
      cleaningMinutes: 35,
      roomCount: 0,
      isActive: true,
      createdBy: admin.user.id,
    });
  });

  it('names are unique per hotel (any case) but can repeat in another hotel', async () => {
    const admin = await signedInAs(app);
    const astara = await makeHotel(admin);
    const other = await makeHotel(admin, 'Old Anchor');
    await makeType(admin, astara);

    const dup = await makeType(admin, astara, { name: 'DELUXE ROOM' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('NAME_TAKEN');

    const elsewhere = await makeType(admin, other);
    expect(elsewhere.status).toBe(201);
    expect(elsewhere.body.data.code).toBe('DLX');
  });

  it('validates input and the hotel', async () => {
    const admin = await signedInAs(app);
    const hotelId = await makeHotel(admin);
    expect((await makeType(admin, hotelId, { cleaningMinutes: 2 })).status).toBe(400);
    expect((await makeType(admin, hotelId, { code: 'X' })).status).toBe(400);
    expect((await admin.get('/api/v1/hotels/not-an-id/room-types')).status).toBe(400);
    expect((await admin.get('/api/v1/hotels/6b0036f13df3469a1d8ca6e8/room-types')).status).toBe(
      404,
    );
  });

  it('counts rooms, and blocks deactivating or deleting a type that has rooms', async () => {
    const admin = await signedInAs(app);
    const hotelId = await makeHotel(admin);
    const typeId = (await makeType(admin, hotelId)).body.data.id;
    await admin.post(`/api/v1/hotels/${hotelId}/rooms`, { roomNumber: '101', roomTypeId: typeId });

    const list = await admin.get(`/api/v1/hotels/${hotelId}/room-types`);
    expect(list.body.data.items[0].roomCount).toBe(1);

    const off = await admin.patch(`/api/v1/hotels/${hotelId}/room-types/${typeId}`, {
      isActive: false,
    });
    expect(off.status).toBe(409);
    expect(off.body.error.code).toBe('ROOM_TYPE_IN_USE');
    expect((await admin.delete(`/api/v1/hotels/${hotelId}/room-types/${typeId}`)).status).toBe(409);
  });

  it('deactivates and deletes an unused type', async () => {
    const admin = await signedInAs(app);
    const hotelId = await makeHotel(admin);
    const typeId = (await makeType(admin, hotelId)).body.data.id;
    const base = `/api/v1/hotels/${hotelId}/room-types/${typeId}`;

    expect((await admin.patch(base, { isActive: false })).body.data.isActive).toBe(false);
    expect((await admin.delete(base)).status).toBe(204);
    expect((await admin.get(base)).status).toBe(404);
  });
});

describe('rooms', () => {
  async function setup() {
    const admin = await signedInAs(app);
    const hotelId = await makeHotel(admin);
    const typeId = (await makeType(admin, hotelId)).body.data.id as string;
    const rooms = `/api/v1/hotels/${hotelId}/rooms`;
    return { admin, hotelId, typeId, rooms };
  }

  it('creates a room with its type, floor, sellable flag and notes', async () => {
    const { admin, typeId, rooms } = await setup();
    const res = await admin.post(rooms, {
      roomNumber: 'a-12',
      roomTypeId: typeId,
      floor: 1,
      isSellable: false,
      notes: 'Geyser weak',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      roomNumber: 'A-12',
      roomType: { id: typeId, name: 'Deluxe Room', code: 'DLX' },
      floor: 1,
      isSellable: false,
      notes: 'Geyser weak',
      isActive: true,
    });
  });

  it('room numbers are unique per hotel but can repeat in another hotel', async () => {
    const { admin, typeId, rooms } = await setup();
    await admin.post(rooms, { roomNumber: '101', roomTypeId: typeId });
    const dup = await admin.post(rooms, { roomNumber: '101', roomTypeId: typeId });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ROOM_NUMBER_TAKEN');

    const other = await makeHotel(admin, 'Old Anchor');
    const otherType = (await makeType(admin, other)).body.data.id;
    const ok = await admin.post(`/api/v1/hotels/${other}/rooms`, {
      roomNumber: '101',
      roomTypeId: otherType,
    });
    expect(ok.status).toBe(201);
  });

  it('rejects a room type from another hotel or an inactive one', async () => {
    const { admin, hotelId, rooms } = await setup();
    const other = await makeHotel(admin, 'Old Anchor');
    const foreignType = (await makeType(admin, other)).body.data.id;
    const res = await admin.post(rooms, { roomNumber: '101', roomTypeId: foreignType });
    expect(res.status).toBe(400);
    expect(res.body.error.details.roomTypeId).toBeDefined();

    const inactive = (await makeType(admin, hotelId, { name: 'Suite', isActive: false })).body.data
      .id;
    expect((await admin.post(rooms, { roomNumber: '102', roomTypeId: inactive })).status).toBe(400);
  });

  it('lists in natural order with type, floor and number filters', async () => {
    const { admin, hotelId, typeId, rooms } = await setup();
    const suite = (await makeType(admin, hotelId, { name: 'Suite' })).body.data.id;
    for (const [roomNumber, floor, type] of [
      ['10', 1, typeId],
      ['2', 1, typeId],
      ['101', 2, suite],
    ] as const) {
      await admin.post(rooms, { roomNumber, floor, roomTypeId: type });
    }

    const all = await admin.get(rooms);
    expect(all.body.data.items.map((r: { roomNumber: string }) => r.roomNumber)).toEqual([
      '2',
      '10',
      '101',
    ]);
    expect((await admin.get(`${rooms}?roomTypeId=${suite}`)).body.data.total).toBe(1);
    expect((await admin.get(`${rooms}?floor=1`)).body.data.total).toBe(2);
    expect((await admin.get(`${rooms}?q=10`)).body.data.total).toBe(2);
  });

  it('bulk-adds a range, all or nothing', async () => {
    const { admin, typeId, rooms } = await setup();
    const res = await admin.post(`${rooms}/bulk`, {
      from: 101,
      to: 120,
      roomTypeId: typeId,
      floor: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(20);
    expect((await admin.get(rooms)).body.data.total).toBe(20);

    const overlap = await admin.post(`${rooms}/bulk`, { from: 118, to: 125, roomTypeId: typeId });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.message).toContain('118, 119, 120');
    expect((await admin.get(rooms)).body.data.total).toBe(20);

    expect((await admin.post(`${rooms}/bulk`, { from: 5, to: 4, roomTypeId: typeId })).status).toBe(
      400,
    );
    expect(
      (await admin.post(`${rooms}/bulk`, { from: 1, to: 400, roomTypeId: typeId })).status,
    ).toBe(400);
  });

  it('updates, moves to another type, soft-deletes', async () => {
    const { admin, hotelId, typeId, rooms } = await setup();
    const suite = (await makeType(admin, hotelId, { name: 'Suite' })).body.data.id;
    const id = (await admin.post(rooms, { roomNumber: '101', roomTypeId: typeId })).body.data.id;

    const res = await admin.patch(`${rooms}/${id}`, { roomTypeId: suite, floor: 3, notes: null });
    expect(res.body.data).toMatchObject({ roomType: { id: suite }, floor: 3, notes: null });

    expect((await admin.delete(`${rooms}/${id}`)).status).toBe(204);
    expect((await admin.get(`${rooms}/${id}`)).status).toBe(404);
    // The number is free again after delete.
    expect((await admin.post(rooms, { roomNumber: '101', roomTypeId: typeId })).status).toBe(201);
  });

  it('a hotel with rooms or room types cannot be deleted', async () => {
    const { admin, hotelId } = await setup();
    const res = await admin.delete(`/api/v1/hotels/${hotelId}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOTEL_IN_USE');
  });
});
