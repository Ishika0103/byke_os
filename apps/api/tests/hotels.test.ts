import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { hotelCodeFromName as codeFromName } from '../src/modules/hotels/hotel.service';
import { signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();

const ASTARA = {
  name: 'Astara',
  location: { city: 'Matheran', state: 'Maharashtra' },
  checkInTime: '14:00',
  checkOutTime: '11:00',
};

describe('hotels CRUD', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/v1/hotels')).status).toBe(401);
  });

  it('generates codes from the name', () => {
    expect(codeFromName('The Byke Brightland Resort')).toBe('BRG');
    expect(codeFromName('The Byke Old Anchor Beach Resort')).toBe('OAB');
    expect(codeFromName('The Byke Royal Pearl')).toBe('RP');
    expect(codeFromName('Test')).toBe('TST');
    expect(codeFromName('Astara')).toBe('AST');
    expect(codeFromName('Oia')).toBe('OIA');
    expect(codeFromName('The Byke')).toBe('TB');
  });

  it('creates a hotel with a generated code and records createdBy', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/hotels', ASTARA);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...ASTARA,
      code: 'AST',
      isActive: true,
      createdBy: admin.user.id,
      updatedBy: admin.user.id,
    });
    expect(res.body.data).not.toHaveProperty('isDeleted');
    expect(res.body.data).not.toHaveProperty('_id');
  });

  it('numbers a generated code that is taken, and rejects a duplicate name in any case', async () => {
    const admin = await signedInAs(app);
    await admin.post('/api/v1/hotels', ASTARA);

    const clash = await admin.post('/api/v1/hotels', { ...ASTARA, name: 'Astoria' });
    expect(clash.status).toBe(201);
    expect(clash.body.data.code).toBe('AST2');

    const dupName = await admin.post('/api/v1/hotels', { ...ASTARA, name: 'ASTARA' });
    expect(dupName.status).toBe(409);
    expect(dupName.body.error.code).toBe('NAME_TAKEN');
  });

  it('validates city, times, code format, unknown fields and code changes', async () => {
    const admin = await signedInAs(app);
    const post = (body: object) => admin.post('/api/v1/hotels', { ...ASTARA, ...body });

    expect((await post({ location: { city: 'Matheran', state: 'Goa' } })).status).toBe(400);
    expect((await post({ location: { city: 'Atlantis', state: 'Goa' } })).status).toBe(400);
    expect((await post({ checkInTime: '25:00' })).status).toBe(400);
    expect((await post({ checkOutTime: '2pm' })).status).toBe(400);
    expect((await post({ code: 'ABC' })).status).toBe(400);
    expect((await post({ gstin: 'X' })).status).toBe(400);

    const id = (await post({})).body.data.id;
    expect((await admin.patch(`/api/v1/hotels/${id}`, { code: 'NEW' })).status).toBe(400);
    expect((await admin.patch(`/api/v1/hotels/${id}`, {})).status).toBe(400);
  });

  it('can be created as inactive', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/hotels', { ...ASTARA, isActive: false });
    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(false);
  });

  it('updates fields, deactivates and reactivates', async () => {
    const admin = await signedInAs(app);
    const id = (await admin.post('/api/v1/hotels', ASTARA)).body.data.id;

    const res = await admin.patch(`/api/v1/hotels/${id}`, {
      name: 'Astara Resort',
      location: { city: 'North Goa', state: 'Goa' },
      checkInTime: '13:30',
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Astara Resort',
      code: 'AST',
      location: { city: 'North Goa', state: 'Goa' },
      checkInTime: '13:30',
      checkOutTime: '11:00',
      isActive: false,
    });

    const back = await admin.patch(`/api/v1/hotels/${id}`, { isActive: true });
    expect(back.body.data.isActive).toBe(true);
  });

  it('lists with search (name, code, city) and isActive filter', async () => {
    const admin = await signedInAs(app);
    await admin.post('/api/v1/hotels', ASTARA);
    const ooty = await admin.post('/api/v1/hotels', {
      ...ASTARA,
      name: 'Sunshine Grand',
      location: { city: 'Ooty', state: 'Tamil Nadu' },
    });
    await admin.patch(`/api/v1/hotels/${ooty.body.data.id}`, { isActive: false });

    const all = await admin.get('/api/v1/hotels');
    expect(all.body.data.total).toBe(2);
    expect(all.body.data.items.map((h: { code: string }) => h.code)).toEqual(['AST', 'SG']);

    expect((await admin.get('/api/v1/hotels?q=ooty')).body.data.total).toBe(1);
    expect((await admin.get('/api/v1/hotels?q=sg')).body.data.total).toBe(1);
    expect((await admin.get('/api/v1/hotels?q=tamil')).body.data.total).toBe(1);
    const active = await admin.get('/api/v1/hotels?isActive=true');
    expect(active.body.data.items.map((h: { code: string }) => h.code)).toEqual(['AST']);
  });

  it('soft-deletes: hidden from list and get, and the code can be reused', async () => {
    const admin = await signedInAs(app);
    const id = (await admin.post('/api/v1/hotels', ASTARA)).body.data.id;

    expect((await admin.delete(`/api/v1/hotels/${id}`)).status).toBe(204);
    expect((await admin.get(`/api/v1/hotels/${id}`)).status).toBe(404);
    expect((await admin.get('/api/v1/hotels')).body.data.total).toBe(0);
    expect((await admin.post('/api/v1/hotels', ASTARA)).status).toBe(201);
  });
});
