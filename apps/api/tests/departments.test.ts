import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getDb } from '../src/db/mongoose';
import { UserModel } from '../src/modules/users/user.model';
import { createUser, departmentId, grant, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();
const ID = '0123456789abcdef01234567';

// Keep the four seeded departments, drop anything a previous test added.
beforeEach(async () => {
  await getDb()
    .collection('departments')
    .deleteMany({ code: { $nin: ['HK', 'FO', 'MT', 'FB'] } });
});

describe('departments CRUD', () => {
  it('lists the four seeded departments', async () => {
    const admin = await signedInAs(app);
    const res = await admin.get('/api/v1/departments');
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((d: { code: string }) => d.code).sort()).toEqual([
      'FB',
      'FO',
      'HK',
      'MT',
    ]);
  });

  it('creates a department with a generated code and records createdBy', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/departments', { name: 'Security Services' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Security Services',
      code: 'SS',
      isActive: true,
      createdBy: admin.user.id,
    });
    const second = await admin.post('/api/v1/departments', { name: 'Sales Support' });
    expect(second.body.data.code).toBe('SS2');
  });

  it('rejects duplicate names in any case and invalid input', async () => {
    const admin = await signedInAs(app);
    const dup = await admin.post('/api/v1/departments', { name: 'housekeeping' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('NAME_TAKEN');

    expect((await admin.post('/api/v1/departments', { name: 'X' })).status).toBe(400);
    expect((await admin.post('/api/v1/departments', { name: 'Valid', code: 'ZZ' })).status).toBe(
      400,
    );
    const hk = await departmentId('HK');
    expect((await admin.patch(`/api/v1/departments/${hk}`, {})).status).toBe(400);
    expect((await admin.patch(`/api/v1/departments/${hk}`, { code: 'NEW' })).status).toBe(400);
    expect((await admin.get('/api/v1/departments/not-an-id')).status).toBe(400);
    expect((await admin.get(`/api/v1/departments/${ID}`)).status).toBe(404);
  });

  it('updates name and status, but not into another department name', async () => {
    const admin = await signedInAs(app);
    const id = (await admin.post('/api/v1/departments', { name: 'Spa' })).body.data.id;

    const renamed = await admin.patch(`/api/v1/departments/${id}`, { name: 'Spa and Wellness' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Spa and Wellness');

    const off = await admin.patch(`/api/v1/departments/${id}`, { isActive: false });
    expect(off.body.data.isActive).toBe(false);

    const clash = await admin.patch(`/api/v1/departments/${id}`, { name: 'maintenance' });
    expect(clash.status).toBe(409);
  });

  it('filters by search text and status', async () => {
    const admin = await signedInAs(app);
    const id = (await admin.post('/api/v1/departments', { name: 'Spa' })).body.data.id;
    await admin.patch(`/api/v1/departments/${id}`, { isActive: false });

    const q = await admin.get('/api/v1/departments?q=house');
    expect(q.body.data.items.map((d: { code: string }) => d.code)).toEqual(['HK']);
    const off = await admin.get('/api/v1/departments?isActive=false');
    expect(off.body.data.items.map((d: { id: string }) => d.id)).toEqual([id]);
  });

  it('soft-deletes, and blocks delete while a user belongs to it (409 DEPARTMENT_IN_USE)', async () => {
    const admin = await signedInAs(app);
    const free = (await admin.post('/api/v1/departments', { name: 'Spa' })).body.data.id;
    expect((await admin.delete(`/api/v1/departments/${free}`)).status).toBe(204);
    expect((await admin.get(`/api/v1/departments/${free}`)).status).toBe(404);
    // The name can be used again after a delete.
    expect((await admin.post('/api/v1/departments', { name: 'Spa' })).status).toBe(201);

    const used = (await admin.post('/api/v1/departments', { name: 'Laundry' })).body.data.id;
    const { id: userId } = await createUser({ role: 'STAFF' });
    await UserModel.updateOne({ _id: userId }, { departmentIds: [used] });
    const blocked = await admin.delete(`/api/v1/departments/${used}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEPARTMENT_IN_USE');

    await UserModel.updateOne({ _id: userId }, { departmentIds: [] });
    expect((await admin.delete(`/api/v1/departments/${used}`)).status).toBe(204);
  });
});

describe('department permissions', () => {
  it('needs the named permission for each action', async () => {
    const staff = await signedInAs(app, 'STAFF');
    const hk = await departmentId('HK');

    for (const [res, perm] of [
      [await staff.get('/api/v1/departments'), 'view-department'],
      [await staff.post('/api/v1/departments', { name: 'Spa' }), 'add-department'],
      [await staff.patch(`/api/v1/departments/${hk}`, { isActive: false }), 'edit-department'],
      [await staff.delete(`/api/v1/departments/${hk}`), 'delete-department'],
    ] as const) {
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain(perm);
    }

    await grant('STAFF', ['view-department', 'add-department']);
    expect((await staff.get('/api/v1/departments')).status).toBe(200);
    expect((await staff.post('/api/v1/departments', { name: 'Spa' })).status).toBe(201);
    expect((await staff.delete(`/api/v1/departments/${hk}`)).status).toBe(403);
  });

  it('the list is open to anyone who can use the user or task pickers', async () => {
    const staff = await signedInAs(app, 'STAFF');
    for (const perm of [
      'view-user',
      'add-user',
      'edit-user',
      'view-task',
      'add-task',
      'edit-task',
    ]) {
      await grant('STAFF', [perm]);
      expect((await staff.get('/api/v1/departments')).status).toBe(200);
    }
  });
});
