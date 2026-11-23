import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@byke-os/shared';
import { createApp } from '../src/app';
import { createHotel, createUser, grant, roleId, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();
const ID = '0123456789abcdef01234567';

describe('role permissions (Plan 06)', () => {
  it('a role with no permissions is refused everywhere, naming the missing permission', async () => {
    const hotel = await createHotel();
    const staff = await signedInAs(app, 'STAFF', [hotel]);
    const h = `/api/v1/hotels/${hotel}`;

    const calls: [string, string, string][] = [
      ['get', '/api/v1/users', 'view-user'],
      ['post', '/api/v1/users', 'add-user'],
      ['get', `/api/v1/users/${ID}`, 'view-user'],
      ['patch', `/api/v1/users/${ID}`, 'edit-user'],
      ['delete', `/api/v1/users/${ID}`, 'delete-user'],
      ['post', `/api/v1/users/${ID}/reset-password`, 'edit-user'],
      ['post', '/api/v1/hotels', 'add-hotel'],
      ['patch', `/api/v1/hotels/${ID}`, 'edit-hotel'],
      ['delete', `/api/v1/hotels/${ID}`, 'delete-hotel'],
      ['get', `${h}/room-types`, 'view-room-type'],
      ['post', `${h}/room-types`, 'add-room-type'],
      ['patch', `${h}/room-types/${ID}`, 'edit-room-type'],
      ['delete', `${h}/room-types/${ID}`, 'delete-room-type'],
      ['get', `${h}/rooms`, 'view-room'],
      ['post', `${h}/rooms`, 'add-room'],
      ['post', `${h}/rooms/bulk`, 'add-room'],
      ['patch', `${h}/rooms/${ID}`, 'edit-room'],
      ['delete', `${h}/rooms/${ID}`, 'delete-room'],
      ['get', `${h}/tasks`, 'view-task'],
      ['get', `${h}/tasks/summary`, 'view-task'],
      ['post', `${h}/tasks`, 'add-task'],
      ['patch', `${h}/tasks/${ID}`, 'edit-task'],
      ['post', `${h}/tasks/${ID}/actions`, 'edit-task'],
      ['post', `${h}/uploads`, 'edit-task'],
    ];
    for (const [method, url, permission] of calls) {
      const res = await (
        staff as unknown as Record<
          string,
          (
            u: string,
            b?: object,
          ) => Promise<{ status: number; body: { error: { message: string } } }>
        >
      )[method](url, {});
      expect(res.status, `${method} ${url}`).toBe(403);
      expect(res.body.error.message).toContain(permission);
    }

    // Own hotels are still listed (needed to use the app), and /auth/me works.
    expect((await staff.get('/api/v1/hotels')).status).toBe(200);
    const me = await staff.get('/api/v1/auth/me');
    expect(me.body.data.permissions).toEqual([]);
  });

  it('view only lets a role list but not add, edit or delete; granting add then allows it at once', async () => {
    const hotel = await createHotel();
    await grant('GM', ['view-room', 'view-room-type']);
    const gm = await signedInAs(app, 'GM', [hotel]);
    const rooms = `/api/v1/hotels/${hotel}/rooms`;

    expect((await gm.get(rooms)).status).toBe(200);
    expect((await gm.post(rooms, { roomNumber: '101', roomTypeId: ID })).status).toBe(403);

    // Same token, permission added in the database: applies without signing in again.
    await grant('GM', ['view-room', 'view-room-type', 'add-room']);
    const res = await gm.post(rooms, { roomNumber: '101', roomTypeId: ID });
    expect(res.status).not.toBe(403);
  });

  it('Super Admin gets through everything and sees ["*"]', async () => {
    const admin = await signedInAs(app);
    expect((await admin.get('/api/v1/users')).status).toBe(200);
    expect((await admin.get('/api/v1/auth/me')).body.data.permissions).toEqual(['*']);
  });

  it('roles and permissions are for Super Admin only; the role picker needs a user permission', async () => {
    await grant('HO', [...PERMISSIONS]);
    const ho = await signedInAs(app, 'HO');
    for (const [method, url] of [
      ['get', '/api/v1/roles'],
      ['post', '/api/v1/roles'],
      ['get', `/api/v1/roles/${ID}`],
      ['patch', `/api/v1/roles/${ID}`],
      ['delete', `/api/v1/roles/${ID}`],
    ] as const) {
      const res = await (
        ho as unknown as Record<string, (u: string, b?: object) => Promise<{ status: number }>>
      )[method](url, {});
      expect(res.status, `${method} ${url}`).toBe(403);
    }

    const picker = await ho.get('/api/v1/roles/options');
    expect(picker.status).toBe(200);
    expect(picker.body.data[0]).not.toHaveProperty('permissions');

    const nobody = await signedInAs(app, 'STAFF');
    expect((await nobody.get('/api/v1/roles/options')).status).toBe(403);
  });

  it("Super Admin sets a role's permissions; they are validated and saved in one update", async () => {
    const admin = await signedInAs(app);
    const gm = await roleId('GM');
    const url = `/api/v1/roles/${gm}`;

    const ok = await admin.patch(url, {
      permissions: ['view-hotel', 'add-room', 'view-room', 'view-room', 'edit-room'],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.permissions).toEqual(['view-hotel', 'add-room', 'view-room', 'edit-room']);
    expect((await admin.get(url)).body.data.permissions).toHaveLength(4);

    const unknown = await admin.patch(url, { permissions: ['view-hotel', 'fly-plane'] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details.permissions).toBeDefined();

    const star = await admin.patch(url, { permissions: ['*'] });
    expect(star.status).toBe(400);

    const noView = await admin.patch(url, { permissions: ['add-hotel'] });
    expect(noView.status).toBe(400);
    expect((await admin.get(url)).body.data.permissions).toHaveLength(4);

    expect((await admin.patch(url, { permissions: [] })).body.data.permissions).toEqual([]);
  });

  it("Super Admin's own permissions can't be changed", async () => {
    const admin = await signedInAs(app);
    const res = await admin.patch(`/api/v1/roles/${await roleId('SUPER_ADMIN')}`, {
      permissions: ['view-user'],
    });
    expect(res.status).toBe(403);
    expect((await admin.get('/api/v1/auth/me')).body.data.permissions).toEqual(['*']);
  });

  it('the migration gives Super Admin * and every other role none', async () => {
    const admin = await signedInAs(app);
    const list = await admin.get('/api/v1/roles?limit=50');
    for (const role of list.body.data.items as { code: string; permissions: string[] }[]) {
      expect(role.permissions).toEqual(role.code === 'SUPER_ADMIN' ? ['*'] : []);
    }
    expect(await createUser({ role: 'GM' })).toBeDefined();
  });
});
