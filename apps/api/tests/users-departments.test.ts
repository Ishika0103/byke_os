import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getDb } from '../src/db/mongoose';
import { createHotel, departmentId, roleId, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();

const newUser = async (overrides: Record<string, unknown> = {}) => ({
  name: 'Priya Nair',
  email: 'priya@test.local',
  mobile: '9876543210',
  roleId: await roleId('HOD'),
  hotelIds: [await createHotel()],
  departmentIds: [await departmentId()],
  password: 'Welcome123',
  ...overrides,
});

const codes = (r: { body: { data: { departments: { code: string }[] } } }) =>
  r.body.data.departments.map((d) => d.code);

describe('user departments (Plan 09)', () => {
  it('requires at least one active, existing department on create', async () => {
    const admin = await signedInAs(app);
    expect((await admin.post('/api/v1/users', await newUser({ departmentIds: [] }))).status).toBe(
      400,
    );
    const missing = await newUser();
    delete (missing as Record<string, unknown>).departmentIds;
    expect((await admin.post('/api/v1/users', missing)).status).toBe(400);

    const unknown = await admin.post(
      '/api/v1/users',
      await newUser({ departmentIds: ['0123456789abcdef01234567'] }),
    );
    expect(unknown.body.error.details.departmentIds).toBeDefined();

    const fo = await departmentId('FO');
    const departments = getDb().collection('departments');
    await departments.updateOne({ code: 'FO' }, { $set: { isActive: false } });
    const inactive = await admin.post('/api/v1/users', await newUser({ departmentIds: [fo] }));
    await departments.updateOne({ code: 'FO' }, { $set: { isActive: true } });
    expect(inactive.body.error.details.departmentIds).toBeDefined();
  });

  it('saves several departments sorted by name; update and list filter work', async () => {
    const admin = await signedInAs(app);
    const hk = await departmentId('HK');
    const fo = await departmentId('FO');
    const mt = await departmentId('MT');
    const created = await admin.post(
      '/api/v1/users',
      await newUser({ departmentIds: [hk, fo, hk] }),
    );
    expect(created.status).toBe(201);
    expect(codes(created)).toEqual(['FO', 'HK']);
    const id = created.body.data.id;

    expect((await admin.patch(`/api/v1/users/${id}`, { departmentIds: [] })).status).toBe(400);
    expect((await admin.patch(`/api/v1/users/${id}`, { name: 'Renamed' })).status).toBe(200);
    const moved = await admin.patch(`/api/v1/users/${id}`, { departmentIds: [mt] });
    expect(codes(moved)).toEqual(['MT']);

    const byDept = await admin.get(`/api/v1/users?departmentId=${mt}`);
    expect(byDept.body.data.items.map((u: { id: string }) => u.id)).toEqual([id]);
    expect((await admin.get(`/api/v1/users?departmentId=${hk}`)).body.data.total).toBe(0);
  });
});
