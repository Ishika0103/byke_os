import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createUser, login, signedInAs, useTestDatabase, locationId } from './helpers';

useTestDatabase();

const app = createApp();

type Admin = Awaited<ReturnType<typeof signedInAs>>;

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const PHOTO = '/uploads/0b6f8a52-4c1e-4f7a-9a51-6c2d9f1e2a3b.jpg';

async function setup() {
  const admin = await signedInAs(app);
  const hotel = await admin.post('/api/v1/hotels', {
    name: 'Astara',
    locationId: await locationId(),
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });
  const hotelId = hotel.body.data.id as string;
  const type = await admin.post(`/api/v1/hotels/${hotelId}/room-types`, { name: 'Deluxe' });
  const room = await admin.post(`/api/v1/hotels/${hotelId}/rooms`, {
    roomNumber: '101',
    roomTypeId: type.body.data.id,
  });
  const base = `/api/v1/hotels/${hotelId}/tasks`;
  return { admin, hotelId, roomId: room.body.data.id as string, base };
}

async function makeTask(admin: Admin, base: string, body: object = {}) {
  const res = await admin.post(base, {
    title: 'Clean room 101',
    department: 'housekeeping',
    dueAt: inHours(2),
    ...body,
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

/** A second signed-in user (verification must be by someone else). */
async function secondUser() {
  const user = await createUser({ name: 'Priya Supervisor' });
  const { accessToken } = await login(app, user.email);
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    user,
    post: (url: string, body?: object) => request(app).post(url).set(auth).send(body),
  };
}

describe('tasks', () => {
  it('creates a task with room and assignee, logged as created', async () => {
    const { admin, roomId, base } = await setup();
    const res = await admin.post(base, {
      title: 'Clean room 101',
      department: 'housekeeping',
      roomId,
      assigneeId: admin.user.id,
      dueAt: inHours(2),
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Clean room 101',
      department: 'housekeeping',
      room: { id: roomId, roomNumber: '101' },
      assignee: { id: admin.user.id, name: 'Test User' },
      stage: 'pending',
      isOverdue: false,
    });
    expect(res.body.data.updates).toEqual([
      expect.objectContaining({ kind: 'created', toStage: 'pending', by: expect.any(Object) }),
    ]);
  });

  it('validates input, room and assignee', async () => {
    const { admin, base } = await setup();
    const bad = await admin.post(base, { title: 'x', department: 'kitchen', dueAt: 'soon' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details)).toEqual(
      expect.arrayContaining(['title', 'department', 'dueAt']),
    );

    const other = await admin.post('/api/v1/hotels', {
      name: 'Old Anchor',
      locationId: await locationId(),
      checkInTime: '14:00',
      checkOutTime: '11:00',
    });
    const t = await admin.post(`/api/v1/hotels/${other.body.data.id}/room-types`, {
      name: 'Suite',
    });
    const foreignRoom = await admin.post(`/api/v1/hotels/${other.body.data.id}/rooms`, {
      roomNumber: '1',
      roomTypeId: t.body.data.id,
    });
    const res = await admin.post(base, {
      title: 'Fix AC',
      department: 'maintenance',
      dueAt: inHours(1),
      roomId: foreignRoom.body.data.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.roomId).toBeDefined();

    const inactive = await createUser({ isActive: false });
    const res2 = await admin.post(base, {
      title: 'Fix AC',
      department: 'maintenance',
      dueAt: inHours(1),
      assigneeId: inactive.id,
    });
    expect(res2.body.error.details.assigneeId).toBeDefined();
  });

  it('runs the full lifecycle with proof and verification by someone else', async () => {
    const { admin, base } = await setup();
    const { id } = await makeTask(admin, base);
    const act = (body: object) => admin.post(`${base}/${id}/actions`, body);

    expect((await act({ action: 'start' })).body.data.stage).toBe('in_progress');

    const noProof = await act({ action: 'done' });
    expect(noProof.status).toBe(400);
    expect(noProof.body.error.details.note).toBeDefined();

    const done = await act({ action: 'done', photos: [PHOTO], note: 'Bathroom fixed' });
    expect(done.body.data).toMatchObject({ stage: 'done', doneBy: { id: admin.user.id } });

    const self = await act({ action: 'verify' });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('SELF_VERIFY');

    const supervisor = await secondUser();
    const verified = await supervisor.post(`${base}/${id}/actions`, { action: 'verify' });
    expect(verified.status).toBe(200);
    expect(verified.body.data).toMatchObject({
      stage: 'verified',
      verifiedBy: { id: supervisor.user.id, name: 'Priya Supervisor' },
    });
    expect(verified.body.data.updates.map((u: { kind: string }) => u.kind)).toEqual([
      'created',
      'started',
      'done',
      'verified',
    ]);
    expect(verified.body.data.updates[2]).toMatchObject({
      fromStage: 'in_progress',
      toStage: 'done',
      note: 'Bathroom fixed',
      photos: [{ url: PHOTO }],
    });

    // Verified is final.
    const again = await act({ action: 'start' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STAGE');
  });

  it('rejects steps that do not fit the stage, and photos outside "done"', async () => {
    const { admin, base } = await setup();
    const { id } = await makeTask(admin, base);
    const act = (body: object) => admin.post(`${base}/${id}/actions`, body);
    expect((await act({ action: 'done', note: 'x' })).status).toBe(409);
    expect((await act({ action: 'verify' })).status).toBe(409);
    expect((await act({ action: 'start', photos: [PHOTO] })).status).toBe(400);
    expect((await act({ action: 'block' })).body.error.details.note).toBeDefined();
  });

  it('send back clears the done fields; block returns to the earlier stage', async () => {
    const { admin, base } = await setup();
    const { id } = await makeTask(admin, base);
    const act = (body: object) => admin.post(`${base}/${id}/actions`, body);
    await act({ action: 'start' });

    const blocked = await act({ action: 'block', note: 'Waiting for plumber' });
    expect(blocked.body.data).toMatchObject({
      stage: 'blocked',
      blockedFrom: 'in_progress',
      blockedReason: 'Waiting for plumber',
    });
    const unblocked = await act({ action: 'unblock' });
    expect(unblocked.body.data).toMatchObject({ stage: 'in_progress', blockedReason: null });

    await act({ action: 'done', note: 'Done' });
    const supervisor = await secondUser();
    const back = await supervisor.post(`${base}/${id}/actions`, {
      action: 'send_back',
      note: 'Towels missing',
    });
    expect(back.body.data).toMatchObject({ stage: 'in_progress', doneBy: null, doneAt: null });
  });

  it('cancel needs a reason and is final', async () => {
    const { admin, base } = await setup();
    const { id } = await makeTask(admin, base);
    const act = (body: object) => admin.post(`${base}/${id}/actions`, body);
    expect((await act({ action: 'cancel' })).status).toBe(400);
    expect((await act({ action: 'cancel', note: 'Guest left' })).body.data.stage).toBe('cancelled');
    expect((await act({ action: 'start' })).status).toBe(409);
    expect((await admin.patch(`${base}/${id}`, { title: 'New title' })).status).toBe(409);
  });

  it('logs edits with readable before / after values', async () => {
    const { admin, roomId, base } = await setup();
    const { id } = await makeTask(admin, base);
    const res = await admin.patch(`${base}/${id}`, {
      title: 'Deep clean room 101',
      department: 'maintenance',
      roomId,
      assigneeId: admin.user.id,
    });
    expect(res.status).toBe(200);
    const edit = res.body.data.updates.at(-1);
    expect(edit.kind).toBe('edited');
    expect(edit.changes).toEqual({
      title: { from: 'Clean room 101', to: 'Deep clean room 101' },
      department: { from: 'Housekeeping', to: 'Maintenance' },
      room: { from: null, to: '101' },
      assignee: { from: null, to: 'Test User' },
    });

    // No real change → no new log row.
    const same = await admin.patch(`${base}/${id}`, { title: 'Deep clean room 101' });
    expect(same.body.data.updates).toHaveLength(2);
  });

  it('lists by view, "me", room and overdue (late first) and counts the summary', async () => {
    const { admin, roomId, base } = await setup();
    const late = await makeTask(admin, base, { title: 'Late one', dueAt: inHours(-1) });
    await makeTask(admin, base, { title: 'Mine', assigneeId: admin.user.id, roomId });
    const waiting = await makeTask(admin, base, { title: 'Waiting' });
    await admin.post(`${base}/${waiting.id}/actions`, { action: 'start' });
    await admin.post(`${base}/${waiting.id}/actions`, { action: 'done', note: 'ok' });
    const closed = await makeTask(admin, base, { title: 'Verified' });
    await admin.post(`${base}/${closed.id}/actions`, { action: 'start' });
    await admin.post(`${base}/${closed.id}/actions`, { action: 'done', note: 'ok' });
    await (await secondUser()).post(`${base}/${closed.id}/actions`, { action: 'verify' });

    const open = await admin.get(base);
    expect(open.body.data.items.map((t: { title: string }) => t.title)).toEqual([
      'Late one',
      'Mine',
    ]);
    expect(open.body.data.items[0].isOverdue).toBe(true);
    expect((await admin.get(`${base}?view=waiting`)).body.data.total).toBe(1);
    expect((await admin.get(`${base}?view=closed`)).body.data.total).toBe(1);
    expect((await admin.get(`${base}?view=all`)).body.data.total).toBe(4);
    expect((await admin.get(`${base}?assigneeId=me`)).body.data.total).toBe(1);
    expect((await admin.get(`${base}?roomId=${roomId}`)).body.data.total).toBe(1);
    const overdue = await admin.get(`${base}?overdue=true&view=all`);
    expect(overdue.body.data.items.map((t: { id: string }) => t.id)).toEqual([late.id]);

    const summary = await admin.get(`${base}/summary`);
    expect(summary.body.data).toEqual({ overdue: 1, open: 2, waiting: 1, closedToday: 1 });
  });

  it('a hotel with tasks cannot be deleted', async () => {
    const { admin, hotelId, base } = await setup();
    await makeTask(admin, base);
    expect((await admin.delete(`/api/v1/hotels/${hotelId}`)).status).toBe(409);
  });
});

describe('uploads', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );

  it('saves an image and serves it; rejects other files', async () => {
    const { admin, hotelId } = await setup();
    const url = `/api/v1/hotels/${hotelId}/uploads`;
    const res = await request(app).post(url).set(admin.auth).attach('file', PNG, 'proof.png');
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9-]{36}\.png$/);

    const served = await request(app).get(res.body.data.url);
    expect(served.status).toBe(200);
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const text = await request(app)
      .post(url)
      .set(admin.auth)
      .attach('file', Buffer.from('not an image'), 'x.png');
    expect(text.status).toBe(400);
    expect(text.body.error.details.file).toBeDefined();

    const big = await request(app)
      .post(url)
      .set(admin.auth)
      .attach('file', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'big.png');
    expect(big.status).toBe(400);

    expect((await request(app).post(url).attach('file', PNG, 'p.png')).status).toBe(401);
  });
});
