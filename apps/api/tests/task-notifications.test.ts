import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getDb } from '../src/db/mongoose';
import { createUser, locationId, login, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();
const app = createApp();

describe('task notifications', () => {
  it('tells assignees about a new task, and the verifier when it is done', async () => {
    const admin = await signedInAs(app);
    const hotelId = (
      await admin.post('/api/v1/hotels', {
        name: 'Astara',
        locationId: await locationId(),
        checkInTime: '14:00',
        checkOutTime: '11:00',
      })
    ).body.data.id as string;
    const staff = await createUser({ name: 'Riya Staff', hotelIds: [hotelId] });
    const verifier = await createUser({ name: 'Vik Verifier', hotelIds: [hotelId] });
    const dept = await getDb().collection('departments').findOne({ name: 'Housekeeping' });

    const created = await admin.post(`/api/v1/hotels/${hotelId}/tasks`, {
      title: 'Clean room',
      departmentId: String(dept!._id),
      assigneeIds: [String(staff.id)],
      verifierId: verifier.id,
      dueAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(created.status).toBe(201);
    const taskId = created.body.data.tasks[0].id as string;

    const { accessToken } = await login(app, staff.email);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const mine = await request(app).get('/api/v1/notifications').set(auth);
    expect(mine.body.data.items.map((n: { kind: string }) => n.kind)).toEqual(['task_assigned']);

    // The assignee does the work: the creator hears about it, the assignee does not.
    const base = `/api/v1/hotels/${hotelId}/tasks/${taskId}/actions`;
    await request(app).post(base).set(auth).send({ action: 'start' });
    await request(app)
      .post(base)
      .set(auth)
      .send({ action: 'done', photos: ['/uploads/0b6f8a52-4c1e-4f7a-9a51-6c2d9f1e2a3b.jpg'] });
    const adminList = await admin.get('/api/v1/notifications');
    const kinds = adminList.body.data.items.map((n: { kind: string }) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(['task_started', 'task_done']));
    // The verifier (not the creator) is asked to verify.
    expect(kinds).not.toContain('task_needs_verification');
    const vAuth = { Authorization: `Bearer ${(await login(app, verifier.email)).accessToken}` };
    const vList = await request(app).get('/api/v1/notifications').set(vAuth);
    expect(vList.body.data.items.map((n: { kind: string }) => n.kind)).toEqual([
      'task_needs_verification',
    ]);
    const after = await request(app).get('/api/v1/notifications').set(auth);
    expect(after.body.data.items).toHaveLength(1);
  });
});
