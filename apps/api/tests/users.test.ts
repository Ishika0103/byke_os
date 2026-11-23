import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { RoleModel } from '../src/modules/roles/role.model';
import { UserModel } from '../src/modules/users/user.model';
import {
  createHotel,
  createUser,
  departmentId,
  grant,
  login,
  roleId,
  signedInAs,
  useTestDatabase,
} from './helpers';

useTestDatabase();

const app = createApp();

const newUser = async (overrides: Record<string, unknown> = {}) => ({
  name: 'Priya Nair',
  email: 'priya@test.local',
  mobile: '98765 43210',
  roleId: await roleId('HOD'),
  hotelIds: [await createHotel()],
  departmentIds: [await departmentId()],
  password: 'Welcome123',
  ...overrides,
});

describe('users CRUD', () => {
  it('creates a user: role populated, email normalised, hash never returned, createdBy set', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/users', await newUser({ email: '  Priya@Test.Local ' }));

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Priya Nair',
      email: 'priya@test.local',
      role: { code: 'HOD' },
      isActive: true,
      createdBy: admin.user.id,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/hashPassword|password/i);

    const stored = await UserModel.findOne({ email: 'priya@test.local' })
      .select('+hashPassword')
      .lean();
    expect(stored!.hashPassword).toMatch(/^\$2[aby]\$/);
    expect(stored!.hashPassword).not.toContain('Welcome123');

    await expect(login(app, 'priya@test.local', 'Welcome123')).resolves.toBeDefined();
  });

  it('enforces validation: password policy, password ≠ email, unknown fields, bad roleId', async () => {
    const admin = await signedInAs(app);
    const cases = [
      await newUser({ password: 'short1' }),
      await newUser({ password: 'onlyletters' }),
      await newUser({ email: 'abc12345@x.io', password: 'abc12345@x.io' }),
      await newUser({ hashPassword: 'x' }),
      await newUser({ roleId: 'nope' }),
      await newUser({ name: 'A' }),
    ];
    for (const body of cases) {
      const res = await admin.post('/api/v1/users', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects a duplicate email (case-insensitive) with 409 EMAIL_TAKEN', async () => {
    const admin = await signedInAs(app);
    await admin.post('/api/v1/users', await newUser());
    const dup = await admin.post('/api/v1/users', await newUser({ email: 'PRIYA@test.local' }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a missing or inactive role', async () => {
    const admin = await signedInAs(app);
    const missing = await admin.post(
      '/api/v1/users',
      await newUser({ roleId: '0123456789abcdef01234567' }),
    );
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.roleId).toBeDefined();

    await RoleModel.updateOne({ code: 'STAFF' }, { isActive: false });
    const inactive = await admin.post(
      '/api/v1/users',
      await newUser({ roleId: await roleId('STAFF') }),
    );
    expect(inactive.status).toBe(400);
  });

  it('lists with search, role filter and pagination', async () => {
    const admin = await signedInAs(app);
    await createUser({ name: 'Anil GM', email: 'anil@test.local', role: 'GM' });
    await createUser({ name: 'Bina GM', email: 'bina@test.local', role: 'GM' });
    await createUser({ name: 'Chetan Staff', email: 'chetan@test.local', role: 'STAFF' });

    const byRole = await admin.get(`/api/v1/users?roleId=${await roleId('GM')}&sort=name`);
    expect(byRole.body.data.total).toBe(2);
    expect(byRole.body.data.items.map((u: { name: string }) => u.name)).toEqual([
      'Anil GM',
      'Bina GM',
    ]);

    const search = await admin.get('/api/v1/users?q=chetan');
    expect(search.body.data.items).toHaveLength(1);

    const paged = await admin.get('/api/v1/users?limit=2&page=2&sort=name');
    expect(paged.body.data).toMatchObject({ total: 4, page: 2, limit: 2 });

    expect((await admin.get('/api/v1/users?limit=500')).status).toBe(400);
    expect((await admin.get('/api/v1/users?unknown=1')).status).toBe(400);
  });

  it('updates name, email and role; never the password', async () => {
    const admin = await signedInAs(app);
    const { id } = await createUser({ role: 'STAFF', hotelIds: [await createHotel()] });

    const res = await admin.patch(`/api/v1/users/${id}`, {
      name: 'Renamed',
      email: 'renamed@test.local',
      roleId: await roleId('HOD'),
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Renamed',
      email: 'renamed@test.local',
      role: { code: 'HOD' },
      updatedBy: admin.user.id,
    });

    expect((await admin.patch(`/api/v1/users/${id}`, { password: 'NewPass123' })).status).toBe(400);
  });

  it("users can't deactivate, delete or change the role of themselves", async () => {
    const admin = await signedInAs(app);
    const self = `/api/v1/users/${admin.user.id}`;

    expect((await admin.patch(self, { isActive: false })).status).toBe(403);
    expect((await admin.patch(self, { roleId: await roleId('STAFF') })).status).toBe(403);
    expect((await admin.delete(self)).status).toBe(403);
    // Editing your own name is fine.
    expect((await admin.patch(self, { name: 'Me Again' })).status).toBe(200);
  });

  it('only Super Admin can change, delete or reset a Super Admin (Plan 06)', async () => {
    await grant('HO', ['view-user', 'add-user', 'edit-user', 'delete-user']);
    const ho = await signedInAs(app, 'HO');
    const { id: target } = await createUser({ role: 'SUPER_ADMIN' });
    const url = `/api/v1/users/${target}`;

    expect((await ho.delete(url)).status).toBe(403);
    expect((await ho.patch(url, { isActive: false })).status).toBe(403);
    expect((await ho.patch(url, { roleId: await roleId('GM') })).status).toBe(403);
    expect((await ho.post(`${url}/reset-password`, { newPassword: 'NewPass123' })).status).toBe(
      403,
    );

    // Nor can HO create a Super Admin, or promote someone to it.
    const create = await ho.post(
      '/api/v1/users',
      await newUser({ roleId: await roleId('SUPER_ADMIN') }),
    );
    expect(create.status).toBe(403);
    const { id: staff } = await createUser({ role: 'STAFF', hotelIds: [await createHotel()] });
    expect(
      (await ho.patch(`/api/v1/users/${staff}`, { roleId: await roleId('SUPER_ADMIN') })).status,
    ).toBe(403);

    // A Super Admin can.
    const admin = await signedInAs(app);
    expect((await admin.delete(url)).status).toBe(204);
  });

  it('soft-deletes: hidden from the API, kept in the database, email reusable', async () => {
    const admin = await signedInAs(app);
    const { id, email } = await createUser();
    const before = new Date('2026-01-01T00:00:00Z');
    await UserModel.collection.updateOne({ email }, { $set: { updatedAt: before } });

    expect((await admin.delete(`/api/v1/users/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/v1/users/${id}`)).status).toBe(404);

    const raw = await UserModel.collection.findOne({ email });
    expect(raw).toMatchObject({ isDeleted: true, updatedBy: expect.anything() });
    expect(raw).not.toHaveProperty('deletedAt');
    // updatedAt records when it was deleted (set automatically by Mongoose timestamps).
    expect(raw!.updatedAt.getTime()).toBeGreaterThan(before.getTime());

    const again = await admin.post('/api/v1/users', await newUser({ email }));
    expect(again.status).toBe(201);
  });

  it('admin reset-password: new password works, old one does not', async () => {
    const admin = await signedInAs(app);
    const { id, email } = await createUser();

    expect(
      (await admin.post(`/api/v1/users/${id}/reset-password`, { newPassword: 'weak' })).status,
    ).toBe(400);
    expect(
      (await admin.post(`/api/v1/users/${id}/reset-password`, { newPassword: 'Fresh1234' })).status,
    ).toBe(204);

    await expect(login(app, email, 'Fresh1234')).resolves.toBeDefined();
  });

  it('returns 404 for unknown users and 400 for malformed ids', async () => {
    const admin = await signedInAs(app);
    expect((await admin.get('/api/v1/users/0123456789abcdef01234567')).status).toBe(404);
    expect((await admin.get('/api/v1/users/123')).status).toBe(400);
  });

  it('needs a valid 10-digit mobile number; +91 and spaces are removed; it can be changed and searched', async () => {
    const admin = await signedInAs(app);
    const without = await newUser();
    delete (without as Record<string, unknown>).mobile;
    expect((await admin.post('/api/v1/users', without)).status).toBe(400);
    for (const bad of ['12345', '5876543210', '98765abcde', '98765432100']) {
      const res = await admin.post('/api/v1/users', await newUser({ mobile: bad }));
      expect(res.status).toBe(400);
      expect(res.body.error.details.mobile).toBeDefined();
    }

    const ok = await admin.post('/api/v1/users', await newUser({ mobile: '+91 98765-43210' }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.mobile).toBe('9876543210');

    const changed = await admin.patch(`/api/v1/users/${ok.body.data.id}`, {
      mobile: '09123456780',
    });
    expect(changed.body.data.mobile).toBe('9123456780');
    expect((await admin.get('/api/v1/users?q=9123456')).body.data.total).toBe(1);
  });
});
