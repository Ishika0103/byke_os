import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getDb } from '../src/db/mongoose';
import { notificationService } from '../src/modules/notifications/notification.service';
import { signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();
const API = '/api/v1/notifications';
const oid = () => new Types.ObjectId().toString();

async function two() {
  const a = await signedInAs(app);
  const b = await signedInAs(app);
  return { a, b, hotelId: oid() };
}

const send = (
  userIds: string[],
  hotelId: string,
  extra: Partial<Parameters<typeof notificationService.notify>[0]> = {},
) =>
  notificationService.notify({
    userIds,
    hotelId,
    kind: 'task_assigned',
    title: 'New task',
    ...extra,
  });

describe('notify', () => {
  it('creates one per distinct user and skips the actor', async () => {
    const { a, b, hotelId } = await two();
    await send([a.user.id, a.user.id, b.user.id], hotelId, { exceptUserId: b.user.id });
    expect(await getDb().collection('notifications').countDocuments()).toBe(1);
    const res = await a.get(API);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      kind: 'task_assigned',
      title: 'New task',
      body: null,
      taskId: null,
      hotelId,
      readAt: null,
    });
    expect((await b.get(API)).body.data.total).toBe(0);
  });

  it('does not repeat a dedupeKey for the same user', async () => {
    const { a, b, hotelId } = await two();
    await send([a.user.id], hotelId, { dedupeKey: 'k1' });
    await send([a.user.id, b.user.id], hotelId, { dedupeKey: 'k1' });
    expect((await a.get(API)).body.data.total).toBe(1);
    expect((await b.get(API)).body.data.total).toBe(1);
  });

  it('never throws on bad input', async () => {
    const { hotelId } = await two();
    await expect(send(['nope', ''], hotelId)).resolves.toBeUndefined();
    await expect(send([oid()], 'not-an-id')).resolves.toBeUndefined();
    await expect(notificationService.notify({ kind: 'bad' } as never)).resolves.toBeUndefined();
    expect(await getDb().collection('notifications').countDocuments()).toBe(0);
  });
});

describe('notification endpoints', () => {
  it('requires login', async () => {
    const { a } = await two();
    const { default: request } = await import('supertest');
    expect((await request(app).get(API)).status).toBe(401);
    expect(a.auth.Authorization).toBeTruthy();
  });

  it('only shows and changes your own', async () => {
    const { a, b, hotelId } = await two();
    await send([a.user.id], hotelId);
    const id = (await a.get(API)).body.data.items[0].id as string;
    expect((await b.get(API)).body.data.total).toBe(0);
    expect((await b.get(`${API}/unread-count`)).body.data.count).toBe(0);
    expect((await b.patch(`${API}/${id}/read`)).status).toBe(404);
    await b.post(`${API}/read-all`);
    expect((await a.get(`${API}/unread-count`)).body.data.count).toBe(1);
    expect((await a.patch(`${API}/bad-id/read`)).status).toBe(400);
  });

  it('counts, marks one read and marks all read', async () => {
    const { a, hotelId } = await two();
    await send([a.user.id], hotelId, { title: 'one' });
    await send([a.user.id], hotelId, { title: 'two' });
    await send([a.user.id], hotelId, { title: 'three' });
    expect((await a.get(`${API}/unread-count`)).body.data.count).toBe(3);

    const items = (await a.get(API)).body.data.items as { id: string; title: string }[];
    expect(items.map((i) => i.title)).toEqual(['three', 'two', 'one']);

    const read = await a.patch(`${API}/${items[0].id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
    const firstReadAt = read.body.data.readAt;
    // Marking again keeps the original time.
    expect((await a.patch(`${API}/${items[0].id}/read`)).body.data.readAt).toBe(firstReadAt);
    expect((await a.get(`${API}/unread-count`)).body.data.count).toBe(2);

    const unread = await a.get(`${API}?unread=true`);
    expect(unread.body.data.total).toBe(2);
    expect(unread.body.data.items.map((i: { title: string }) => i.title)).toEqual(['two', 'one']);

    const all = await a.post(`${API}/read-all`);
    expect(all.body.data.count).toBe(2);
    expect((await a.get(`${API}/unread-count`)).body.data.count).toBe(0);
    expect((await a.get(`${API}?unread=true`)).body.data.total).toBe(0);
  });

  it('pages newest first', async () => {
    const { a, hotelId } = await two();
    for (let i = 1; i <= 5; i++) await send([a.user.id], hotelId, { title: `n${i}` });
    const p1 = await a.get(`${API}?page=1&limit=2`);
    const p3 = await a.get(`${API}?page=3&limit=2`);
    expect(p1.body.data).toMatchObject({ total: 5, page: 1, limit: 2 });
    expect(p1.body.data.items.map((i: { title: string }) => i.title)).toEqual(['n5', 'n4']);
    expect(p3.body.data.items.map((i: { title: string }) => i.title)).toEqual(['n1']);
  });
});

describe('notifyOverdueTasks', () => {
  it('notifies assignees of late open tasks once, in both task shapes', async () => {
    const { a, b, hotelId } = await two();
    const tasks = getDb().collection('tasks');
    const past = new Date(Date.now() - 3_600_000);
    const future = new Date(Date.now() + 3_600_000);
    const doc = (extra: object) => ({
      hotelId: new Types.ObjectId(hotelId),
      title: 'Clean room',
      isDeleted: false,
      stage: 'pending',
      dueAt: past,
      ...extra,
    });
    const legacy = await tasks.insertOne(doc({ assigneeId: new Types.ObjectId(a.user.id) }));
    const multi = await tasks.insertOne(
      doc({
        title: 'Fix AC',
        assigneeIds: [new Types.ObjectId(a.user.id), new Types.ObjectId(b.user.id)],
      }),
    );
    await tasks.insertOne(
      doc({ title: 'Not yet', dueAt: future, assigneeId: new Types.ObjectId(b.user.id) }),
    );
    await tasks.insertOne(
      doc({ title: 'Closed', stage: 'verified', assigneeId: new Types.ObjectId(b.user.id) }),
    );
    await tasks.insertOne(doc({ title: 'Nobody' }));

    await notificationService.notifyOverdueTasks();
    await notificationService.notifyOverdueTasks();

    const ra = (await a.get(API)).body.data.items as {
      title: string;
      kind: string;
      taskId: string;
    }[];
    expect(ra.map((n) => n.title).sort()).toEqual([
      'Task overdue: Clean room',
      'Task overdue: Fix AC',
    ]);
    expect(ra.every((n) => n.kind === 'task_overdue')).toBe(true);
    expect(ra.map((n) => n.taskId).sort()).toEqual(
      [String(legacy.insertedId), String(multi.insertedId)].sort(),
    );
    const rb = (await b.get(API)).body.data.items as { title: string }[];
    expect(rb.map((n) => n.title)).toEqual(['Task overdue: Fix AC']);
  });
});
