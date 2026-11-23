import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { hotelCodeFromName as codeFromName } from '../src/modules/hotels/hotel.service';
import { locationId, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();

const ASTARA = {
  name: 'Astara',
  locationId: '',
  checkInTime: '14:00',
  checkOutTime: '11:00',
};

beforeAll(async () => {
  ASTARA.locationId = await locationId('Matheran');
});

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
      name: ASTARA.name,
      checkInTime: ASTARA.checkInTime,
      checkOutTime: ASTARA.checkOutTime,
      location: { name: 'Matheran', state: 'Maharashtra' },
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

  it('validates location, times, code format, unknown fields and code changes', async () => {
    const admin = await signedInAs(app);
    const post = (body: object) => admin.post('/api/v1/hotels', { ...ASTARA, ...body });

    expect((await post({ locationId: '6b0036dc52b76c3a9c0862ff' })).status).toBe(400);
    expect((await post({ locationId: 'nope' })).status).toBe(400);
    expect((await post({ location: { city: 'Matheran', state: 'Goa' } })).status).toBe(400);
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
      locationId: await locationId('North Goa'),
      checkInTime: '13:30',
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Astara Resort',
      code: 'AST',
      location: { name: 'North Goa', state: 'Goa' },
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
      locationId: await locationId('Ooty'),
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

describe('locations (Plan 08)', () => {
  it('lists the 21 seeded locations for anyone signed in, login required', async () => {
    expect((await request(app).get('/api/v1/locations')).status).toBe(401);
    const admin = await signedInAs(app);
    const res = await admin.get('/api/v1/locations?limit=100');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(21);
    const names = res.body.data.items.map((l: { name: string }) => l.name);
    expect(names).toEqual(
      expect.arrayContaining(['Matheran', 'North Goa', 'South Goa', 'Borivali']),
    );
    expect(names).not.toContain('Goa');
    expect((await admin.get('/api/v1/locations?q=goa')).body.data.total).toBe(2);
  });

  it('shows the location on a hotel and filters hotels by it', async () => {
    const admin = await signedInAs(app);
    const created = await admin.post('/api/v1/hotels', ASTARA);
    expect(created.body.data.location).toMatchObject({ name: 'Matheran', state: 'Maharashtra' });
    expect(created.body.data.locationId).toBeUndefined();

    const goa = await locationId('South Goa');
    await admin.post('/api/v1/hotels', { ...ASTARA, name: 'Old Anchor', locationId: goa });
    const filtered = await admin.get(`/api/v1/hotels?locationId=${goa}`);
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.items[0].location.name).toBe('South Goa');
  });

  it('rejects an unknown location', async () => {
    const admin = await signedInAs(app);
    const res = await admin.post('/api/v1/hotels', {
      ...ASTARA,
      locationId: '6b0036dc52b76c3a9c0862ff',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.locationId).toBeDefined();
  });
});
