import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { HotelModel } from '../src/modules/hotels/hotel.model';
import {
  createHotel,
  createUser,
  departmentId,
  grant,
  roleId,
  signedInAs,
  useTestDatabase,
} from './helpers';

useTestDatabase();

const app = createApp();

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const userBody = async (overrides: Record<string, unknown> = {}) => ({
  name: 'Priya Nair',
  email: 'priya@test.local',
  mobile: '9876543210',
  roleId: await roleId('GM'),
  departmentIds: [await departmentId()],
  password: 'Welcome123',
  ...overrides,
});

describe('user ↔ hotel mapping (Plan 05)', () => {
  it('saves hotels on create, removes duplicates and returns them sorted by name', async () => {
    const admin = await signedInAs(app);
    const b = await createHotel('Brightland');
    const a = await createHotel('Astara');

    const res = await admin.post('/api/v1/users', await userBody({ hotelIds: [b, a, b] }));
    expect(res.status).toBe(201);
    expect(res.body.data.hotels.map((h: { name: string }) => h.name)).toEqual([
      'Astara',
      'Brightland',
    ]);
    expect(res.body.data.hotels[0]).toEqual({ id: a, name: 'Astara', code: expect.any(String) });
  });

  it('requires at least one existing hotel unless the role is Super Admin', async () => {
    const admin = await signedInAs(app);
    const none = await admin.post('/api/v1/users', await userBody());
    expect(none.status).toBe(400);
    expect(none.body.error.details.hotelIds).toBeDefined();

    const unknown = await admin.post(
      '/api/v1/users',
      await userBody({ hotelIds: ['0123456789abcdef01234567'] }),
    );
    expect(unknown.body.error.details.hotelIds).toBeDefined();

    const deleted = await createHotel();
    await HotelModel.updateOne({ _id: deleted }, { isDeleted: true });
    const gone = await admin.post('/api/v1/users', await userBody({ hotelIds: [deleted] }));
    expect(gone.body.error.details.hotelIds).toBeDefined();

    const inactive = await createHotel();
    await HotelModel.updateOne({ _id: inactive }, { isActive: false });
    const ok = await admin.post('/api/v1/users', await userBody({ hotelIds: [inactive] }));
    expect(ok.status).toBe(201);

    // Super Admin: no hotels needed, and none are stored.
    const sa = await admin.post(
      '/api/v1/users',
      await userBody({
        email: 'sa@test.local',
        roleId: await roleId('SUPER_ADMIN'),
        hotelIds: [inactive],
      }),
    );
    expect(sa.status).toBe(201);
    expect(sa.body.data.hotels).toEqual([]);
  });

  it('checks hotels on update, including when the role moves away from Super Admin', async () => {
    const admin = await signedInAs(app);
    const hotel = await createHotel();
    const { id } = await createUser({ role: 'SUPER_ADMIN' });

    const noHotels = await admin.patch(`/api/v1/users/${id}`, { roleId: await roleId('GM') });
    expect(noHotels.status).toBe(400);
    expect(noHotels.body.error.details.hotelIds).toBeDefined();

    const moved = await admin.patch(`/api/v1/users/${id}`, {
      roleId: await roleId('GM'),
      hotelIds: [hotel],
    });
    expect(moved.status).toBe(200);
    expect(moved.body.data.hotels).toHaveLength(1);

    expect((await admin.patch(`/api/v1/users/${id}`, { hotelIds: [] })).status).toBe(400);
  });

  it('filters the users list by hotel', async () => {
    const admin = await signedInAs(app);
    const [a, b] = [await createHotel(), await createHotel()];
    await createUser({ role: 'GM', name: 'At A', hotelIds: [a] });
    await createUser({ role: 'GM', name: 'At B', hotelIds: [b] });

    const res = await admin.get(`/api/v1/users?hotelId=${a}`);
    expect(res.body.data.items.map((u: { name: string }) => u.name)).toEqual(['At A']);
  });

  it('scopes hotels and hotel data to the user; Super Admin sees all', async () => {
    const admin = await signedInAs(app);
    const [mine, other] = [await createHotel('Astara'), await createHotel('Brightland')];
    await grant('GM', [
      'view-room-type',
      'view-room',
      'view-task',
      'add-room',
      'edit-hotel',
      'edit-task',
    ]);
    const gm = await signedInAs(app, 'GM', [mine]);

    const list = await gm.get('/api/v1/hotels');
    expect(list.body.data.items.map((h: { id: string }) => h.id)).toEqual([mine]);
    expect((await admin.get('/api/v1/hotels')).body.data.total).toBe(2);

    expect((await gm.get(`/api/v1/hotels/${mine}`)).status).toBe(200);
    expect((await gm.get(`/api/v1/hotels/${other}`)).status).toBe(404);
    expect((await gm.patch(`/api/v1/hotels/${other}`, { name: 'Renamed Hotel' })).status).toBe(404);

    for (const path of ['room-types', 'rooms', 'tasks']) {
      expect((await gm.get(`/api/v1/hotels/${mine}/${path}`)).status).toBe(200);
      expect((await gm.get(`/api/v1/hotels/${other}/${path}`)).status).toBe(403);
    }
    expect((await gm.post(`/api/v1/hotels/${other}/uploads`)).status).toBe(403);

    const me = await gm.get('/api/v1/auth/me');
    expect(me.body.data.hotels.map((h: { id: string }) => h.id)).toEqual([mine]);
  });

  it("can't delete a hotel that still has users", async () => {
    const admin = await signedInAs(app);
    const hotel = await createHotel();
    const { id } = await createUser({ role: 'GM', hotelIds: [hotel, await createHotel()] });

    const res = await admin.delete(`/api/v1/hotels/${hotel}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOTEL_IN_USE');

    await admin.patch(`/api/v1/users/${id}`, { hotelIds: [String(await createHotel())] });
    expect((await admin.delete(`/api/v1/hotels/${hotel}`)).status).toBe(204);
  });

  it('only assigns tasks to people at the hotel (Super Admin anywhere)', async () => {
    const admin = await signedInAs(app);
    const [hotel, other] = [await createHotel(), await createHotel()];
    const here = await createUser({ role: 'STAFF', hotelIds: [hotel] });
    const elsewhere = await createUser({ role: 'STAFF', hotelIds: [other] });
    const base = `/api/v1/hotels/${hotel}/tasks`;
    const housekeeping = await departmentId();
    const task = (assigneeId: string) =>
      admin.post(base, {
        title: 'Fix tap',
        departmentId: housekeeping,
        dueAt: inHours(2),
        assigneeIds: [assigneeId],
      });

    expect((await task(here.id)).status).toBe(201);
    expect((await task(admin.user.id)).status).toBe(201);
    const bad = await task(elsewhere.id);
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.assigneeIds).toBeDefined();
  });
});
