import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase, getDb } from '../src/db/mongoose';
import { up as seedSystemRoles } from '../src/db/migrations/2026.11.20T12.02.00.seed-system-roles';
import { up as removeDeletedAt } from '../src/db/migrations/2026.11.20T12.03.00.remove-deleted-at';
import { hashPlainPassword } from '../src/modules/auth/password';
import { RoleModel } from '../src/modules/roles/role.model';
import { UserModel } from '../src/modules/users/user.model';

export const PASSWORD = 'Passw0rd!';

/** Connects once per file and resets data before each test (system roles are restored). */
export function useTestDatabase() {
  beforeAll(() => connectDatabase(process.env.MONGODB_URI));
  afterAll(() => disconnectDatabase());
  beforeEach(async () => {
    const db = getDb();
    await db.collection('users').deleteMany({});
    await db.collection('roles').deleteMany({});
    await db.collection('hotels').deleteMany({});
    await db.collection('roomTypes').deleteMany({});
    await db.collection('rooms').deleteMany({});
    await db.collection('tasks').deleteMany({});
    await db.collection('taskUpdates').deleteMany({});
    await seedSystemRoles({ name: 'seed-system-roles', context: { db } });
    // Apply later migrations that reshape the seeded roles, as on a real database.
    await removeDeletedAt({ name: 'remove-deleted-at', context: { db } });
  });
}

export async function roleId(code: string): Promise<string> {
  const role = await RoleModel.findOne({ code }).select('_id').lean();
  if (!role) throw new Error(`Role ${code} not found`);
  return String(role._id);
}

/** Inserts a user directly (bypassing the API). */
export async function createUser(
  opts: {
    email?: string;
    name?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  } = {},
) {
  const email = opts.email ?? `user${Math.random().toString(36).slice(2, 8)}@test.local`;
  const user = await UserModel.create({
    name: opts.name ?? 'Test User',
    email,
    roleId: await roleId(opts.role ?? 'SUPER_ADMIN'),
    hashPassword: await hashPlainPassword(opts.password ?? PASSWORD),
    isActive: opts.isActive ?? true,
  });
  return { id: String(user._id), email };
}

export async function login(app: ReturnType<typeof createApp>, email: string, password = PASSWORD) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { accessToken: string; refreshToken: string };
}

/** Creates a Super Admin and returns a supertest agent-like helper with its token. */
export async function signedInAs(app: ReturnType<typeof createApp>, role = 'SUPER_ADMIN') {
  const user = await createUser({ role });
  const { accessToken } = await login(app, user.email);
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    user,
    auth,
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string, body?: object) => request(app).post(url).set(auth).send(body),
    patch: (url: string, body?: object) => request(app).patch(url).set(auth).send(body),
    delete: (url: string) => request(app).delete(url).set(auth),
  };
}
