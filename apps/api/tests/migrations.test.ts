import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMigrator } from '../src/db/migrator';
import { connectDatabase, disconnectDatabase, getDb } from '../src/db/mongoose';

beforeAll(() => connectDatabase(process.env.MONGODB_URI));
afterAll(() => disconnectDatabase());

describe('migrations', () => {
  it('all migrations are applied and none are pending', async () => {
    const migrator = createMigrator(getDb());
    expect(await migrator.pending()).toEqual([]);
    expect((await migrator.executed()).length).toBeGreaterThanOrEqual(3);
  });

  it('records names without a file extension (so .ts in dev and .js in prod match)', async () => {
    const executed = await createMigrator(getDb()).executed();
    for (const { name } of executed) expect(name).not.toMatch(/\.(ts|js)$/);
  });

  it('leaves no deletedAt field behind', async () => {
    for (const c of ['users', 'roles']) {
      expect(
        await getDb()
          .collection(c)
          .countDocuments({ deletedAt: { $exists: true } }),
      ).toBe(0);
    }
  });

  it('created the expected indexes', async () => {
    const names = async (c: string) => (await getDb().collection(c).indexes()).map((i) => i.name);
    expect(await names('roles')).toEqual(expect.arrayContaining(['code_unique', 'name_unique_ci']));
    expect(await names('users')).toEqual(
      expect.arrayContaining(['email_unique', 'roleId_1', 'hotelIds_1']),
    );
    expect(await names('hotels')).toEqual(
      expect.arrayContaining(['code_unique', 'name_unique_ci', 'locationId_1']),
    );
    expect(await names('roomTypes')).toEqual(
      expect.arrayContaining(['hotel_code_unique', 'hotel_name_unique_ci']),
    );
    expect(await names('tasks')).toEqual(
      expect.arrayContaining(['hotel_stage_due', 'hotel_assignee_stage', 'roomId_1']),
    );
    expect(await names('taskUpdates')).toEqual(expect.arrayContaining(['task_createdAt']));
    expect(await names('rooms')).toEqual(
      expect.arrayContaining(['hotel_roomNumber_unique', 'roomTypeId_1', 'hotel_floor']),
    );
  });
});
