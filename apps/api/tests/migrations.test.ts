import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { up as convertTasks } from '../src/db/migrations/2026.11.24T12.00.00.tasks-departments-assignees-masters';
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
    expect(await names('roomtypes')).toEqual(
      expect.arrayContaining(['hotel_code_unique', 'hotel_name_unique_ci']),
    );
    expect(await names('tasks')).toEqual(
      expect.arrayContaining([
        'hotel_stage_due',
        'hotel_assignees_stage',
        'hotel_department_stage',
        'groupId_1',
        'roomId_1',
      ]),
    );
    expect(await names('consumptionmodulemasters')).toEqual(
      expect.arrayContaining(['name_unique_ci', 'code_unique']),
    );
    for (const c of [
      'fnbdailyconsumptions',
      'engineeringdailyconsumptions',
      'housekeepingdailyconsumptions',
    ]) {
      expect(await names(c)).toEqual(
        expect.arrayContaining(['hotel_date_module_unique', 'date_hotel']),
      );
    }
    expect(await names('taskupdates')).toEqual(expect.arrayContaining(['task_createdAt']));
    expect(await names('rooms')).toEqual(
      expect.arrayContaining(['hotel_roomNumber_unique', 'roomTypeId_1', 'hotel_floor']),
    );
  });

  it('seeds the six consumption modules, in order, and does not seed them twice', async () => {
    const db = getDb();
    const modules = await db
      .collection('consumptionmodulemasters')
      .find({ isDeleted: false })
      .sort({ sortOrder: 1 })
      .toArray();
    expect(modules.map((m) => m.code)).toEqual(['FB', 'ENG', 'HK', 'ELEC', 'WATER', 'FUEL']);
    expect(modules.map((m) => m.name)).toEqual([
      'F&B',
      'Engineering',
      'Housekeeping',
      'Electricity',
      'Water',
      'Fuel',
    ]);
  });

  it('converts old tasks to departmentId, assigneeIds and groupId, and seeds task masters', async () => {
    const db = getDb();
    const user = new Types.ObjectId();
    const old = await db.collection('tasks').insertMany([
      {
        hotelId: new Types.ObjectId(),
        title: 'Old one',
        department: 'maintenance',
        assigneeId: user,
      },
      {
        hotelId: new Types.ObjectId(),
        title: 'Old two',
        department: 'front_office',
        assigneeId: null,
      },
    ]);
    await convertTasks({ name: 'convert', context: { db } });
    const [a, b] = await db
      .collection('tasks')
      .find({ _id: { $in: Object.values(old.insertedIds) } })
      .sort({ title: 1 })
      .toArray();
    const dept = async (name: string) =>
      (await db.collection('departments').findOne({ name }))!._id;
    expect(a).toMatchObject({
      departmentId: await dept('Maintenance'),
      assigneeIds: [user],
      groupId: a._id,
      taskMasterId: null,
    });
    expect(b).toMatchObject({
      departmentId: await dept('Front Office'),
      assigneeIds: [],
      groupId: b._id,
    });
    expect(a).not.toHaveProperty('department');
    expect(a).not.toHaveProperty('assigneeId');
    expect(await db.collection('taskmasters').countDocuments({ isDeleted: false })).toBe(5);
    await db.collection('tasks').deleteMany({ _id: { $in: Object.values(old.insertedIds) } });
  });
});
