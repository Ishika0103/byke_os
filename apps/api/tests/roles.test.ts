import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { RoleModel } from '../src/modules/roles/role.model';
import { createUser, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();

describe('roles CRUD', () => {
  it('lists the 5 system roles created by the migration', async () => {
    const admin = await signedInAs(app);
    const res = await admin.get('/api/v1/roles?limit=50');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(5);
    expect(res.body.data.items.map((r: { code: string }) => r.code).sort()).toEqual(
      ['GM', 'HO', 'HOD', 'STAFF', 'SUPER_ADMIN'].sort(),
    );
  });

  it('creates a role (code uppercased) and records createdBy', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/roles', { name: 'Front Office', code: 'front_office' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Front Office',
      code: 'FRONT_OFFICE',
      isActive: true,
      createdBy: admin.user.id,
      updatedBy: admin.user.id,
    });
    expect(res.body.data).not.toHaveProperty('isDeleted');
  });

  it('rejects duplicate code (409 CODE_TAKEN) and duplicate name in any case (409 NAME_TAKEN)', async () => {
    const admin = await signedInAs(app);
    const dupCode = await admin.post('/api/v1/roles', { name: 'Another', code: 'GM' });
    expect(dupCode.status).toBe(409);
    expect(dupCode.body.error.code).toBe('CODE_TAKEN');

    const dupName = await admin.post('/api/v1/roles', { name: 'general MANAGER', code: 'GM2' });
    expect(dupName.status).toBe(409);
    expect(dupName.body.error.code).toBe('NAME_TAKEN');
  });

  it('validates input: bad code, unknown fields, empty update, code change', async () => {
    const admin = await signedInAs(app);
    const id = String((await RoleModel.findOne({ code: 'HOD' }).lean())!._id);

    expect((await admin.post('/api/v1/roles', { name: 'X1', code: '1BAD' })).status).toBe(400);
    expect(
      (await admin.post('/api/v1/roles', { name: 'Valid', code: 'VALID', isSystem: true })).status,
    ).toBe(400);
    expect((await admin.patch(`/api/v1/roles/${id}`, {})).status).toBe(400);
    expect((await admin.patch(`/api/v1/roles/${id}`, { code: 'NEW' })).status).toBe(400);
    expect((await admin.get('/api/v1/roles/not-an-id')).status).toBe(400);
  });

  it('updates a role name and deactivates an unused role', async () => {
    const admin = await signedInAs(app);
    const id = String((await RoleModel.findOne({ code: 'HOD' }).lean())!._id);

    const res = await admin.patch(`/api/v1/roles/${id}`, {
      name: 'Department Head',
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Department Head', isActive: false, code: 'HOD' });
  });

  it('refuses to delete or deactivate a role assigned to users (409 ROLE_IN_USE)', async () => {
    const admin = await signedInAs(app);
    await createUser({ role: 'GM' });
    const id = String((await RoleModel.findOne({ code: 'GM' }).lean())!._id);

    const del = await admin.delete(`/api/v1/roles/${id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('ROLE_IN_USE');

    const deactivate = await admin.patch(`/api/v1/roles/${id}`, { isActive: false });
    expect(deactivate.status).toBe(409);
  });

  it('soft-deletes an unused role: hidden from the API, kept in the database, code reusable', async () => {
    const admin = await signedInAs(app);
    const created = await admin.post('/api/v1/roles', { name: 'Temp Role', code: 'TEMP' });
    const id = created.body.data.id;

    expect((await admin.delete(`/api/v1/roles/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/v1/roles/${id}`)).status).toBe(404);

    const raw = await RoleModel.collection.findOne({ code: 'TEMP' });
    expect(raw).toMatchObject({ isDeleted: true, updatedBy: expect.anything() });
    expect(raw).not.toHaveProperty('deletedAt');

    const again = await admin.post('/api/v1/roles', { name: 'Temp Role', code: 'TEMP' });
    expect(again.status).toBe(201);
  });

  it('searches and paginates', async () => {
    const admin = await signedInAs(app);
    const res = await admin.get('/api/v1/roles?q=head&sort=code&limit=1&page=2');
    expect(res.status).toBe(200);
    // "Head Office" (HO) and "Head of Department" (HOD) match; page 2 of size 1 → HOD.
    expect(res.body.data).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(res.body.data.items[0].code).toBe('HOD');
  });

  it('treats regex characters in search as plain text', async () => {
    const admin = await signedInAs(app);
    const res = await admin.get(`/api/v1/roles?q=${encodeURIComponent('.*')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });
});
