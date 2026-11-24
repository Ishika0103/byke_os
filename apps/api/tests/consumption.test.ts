import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getDb } from '../src/db/mongoose';
import {
  parseConsumptionSheet,
  parseSheetDate,
} from '../src/modules/consumption/consumption-sheet';
import { createHotel, createUser, grant, login, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();
const app = createApp();

afterEach(() => vi.unstubAllGlobals());

/**
 * A sheet like the real one: three header rows, then one row per property.
 * Two days (17-Nov, 18-Nov), two modules (F&B, Engineering), Issue + Consumption each.
 */
const HEAD = [
  'Property Details,,,,17-Nov-2026,,,,,18-Nov-2026,,,',
  'Property Code,Property,Cluster,Incharge,F&B,,Engineering,,,F&B,,Engineering,',
  ',,,,Issue,Consumption,Issue,Consumption,,Issue,Consumption,Issue,Consumption',
];
const sheet = (...rows: string[]) => [...HEAD, ...rows, 'Total,,,,1,1,1,1,,1,1,1,1'].join('\n');

/** Makes the server's download of the sheet return `csv` (or a login page when `csv` is null). */
function serveSheet(csv: string | null) {
  vi.stubGlobal(
    'fetch',
    // A new Response per call: a body can only be read once.
    vi
      .fn()
      .mockImplementation(async () =>
        csv === null
          ? new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } })
          : new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8' } }),
      ),
  );
}

async function hotelCode(id: string) {
  const h = await getDb()
    .collection('hotels')
    .findOne({ _id: new (await import('mongodb')).ObjectId(id) });
  return h!.code as string;
}

describe('sheet parser', () => {
  it('reads dates and modules by header, only the Consumption columns, skips Total and blanks', () => {
    const csv = sheet('AST1,Astara,Pravesh,Rishabh,1,0,1,,,0,0,1,1');
    const { cells, problems } = parseConsumptionSheet(csv);
    expect(problems).toEqual([]);
    // 4 Consumption columns minus the one blank cell (the Issue columns are ignored)
    expect(cells).toHaveLength(3);
    expect(cells[0]).toMatchObject({
      row: 4,
      propertyCode: 'AST1',
      moduleLabel: 'F&B',
      isMarked: 0,
    });
    expect(cells[0].date.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(
      cells.find((c) => c.date.getUTCDate() === 18 && c.moduleLabel === 'Engineering'),
    ).toMatchObject({ isMarked: 1 });
  });

  it('skips the Total row wherever the Property Code column is', () => {
    const csv = [
      'Property Details,,,17-Nov-2026,',
      'Property,Property Code,Cluster,F&B,',
      ',,,Issue,Consumption',
      'Astara,AST,X,1,1',
      'Total,,,1,1',
    ].join('\n');
    const { cells, problems } = parseConsumptionSheet(csv);
    expect(problems).toEqual([]);
    expect(cells).toHaveLength(1); // only the Consumption column
  });

  it('reports values that are not 0 or 1 and repeated properties', () => {
    const csv = sheet('AST1,Astara,,,2,x,1,1,,1,1,1,1', 'ast1,Astara again,,,1,1,1,1,,1,1,1,1');
    const { cells, problems } = parseConsumptionSheet(csv);
    expect(problems.map((p) => p.message)).toEqual(
      expect.arrayContaining(['F&B on 17-Nov-2026: "x" is not 0 or 1']),
    );
    expect(problems.filter((p) => p.message.includes('appears twice'))).toHaveLength(3);
    // the first row's 3 good values, plus the repeated row's F&B value (the first row's was bad)
    expect(cells).toHaveLength(4);
  });

  it('needs a Property Code column and real date headers', () => {
    const noCode = HEAD.map((l) => l.replace('Property Code', 'Prop')).join('\n') + '\nA,B';
    expect(() => parseConsumptionSheet(noCode)).toThrow(/Property Code/);
    const badDate = sheet('A1,B').replace('17-Nov-2026', '17-Foo');
    expect(() => parseConsumptionSheet(badDate)).toThrow(/not a date/);
  });

  it('parses dates: no year uses the current year, impossible dates are refused', () => {
    const now = new Date('2026-11-24T10:00:00Z');
    expect(parseSheetDate('17-Nov', now)?.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(parseSheetDate('17-Nov-2025', now)?.toISOString()).toBe('2025-11-17T00:00:00.000Z');
    expect(parseSheetDate('2026-02-03', now)?.toISOString()).toBe('2026-02-03T00:00:00.000Z');
    expect(parseSheetDate('03/02/2026', now)?.toISOString()).toBe('2026-02-03T00:00:00.000Z');
    expect(parseSheetDate('31-Feb', now)).toBeNull();
    expect(parseSheetDate('hello', now)).toBeNull();
  });
});

describe('consumption sync', () => {
  it('previews without saving, creates, then the same sheet again changes nothing', async () => {
    const admin = await signedInAs(app);
    const code = await hotelCode(await createHotel('Astara'));
    serveSheet(sheet(`${code},Astara,,,1,0,1,,,0,0,1,1`));

    const preview = await admin.post('/api/v1/consumption/sync?preview=true');
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ saved: false, created: 3, updated: 0, unchanged: 0 });
    expect(await getDb().collection('consumptions').countDocuments()).toBe(0);

    const first = await admin.post('/api/v1/consumption/sync');
    expect(first.body.data).toMatchObject({ saved: true, created: 3, rejected: 0, issues: [] });
    const rows = await getDb().collection('consumptions').find({}).toArray();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ propertyCode: code, isActive: true, isDeleted: false });
    expect(String(rows[0].createdBy)).toBe(admin.user.id);
    expect(rows.every((r) => r.date instanceof Date && r.date.getUTCHours() === 0)).toBe(true);

    const again = await admin.post('/api/v1/consumption/sync');
    expect(again.body.data).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    expect(await getDb().collection('consumptions').countDocuments()).toBe(3);
  });

  it('updates a changed value in place (no duplicate row) and matches modules by name or code', async () => {
    const admin = await signedInAs(app);
    const code = await hotelCode(await createHotel('Astara'));
    serveSheet(sheet(`${code},Astara,,,0,0,1,1,,,,,`));
    await admin.post('/api/v1/consumption/sync');

    // Engineering written as its code, F&B consumption flips 0 -> 1.
    serveSheet(sheet(`${code},Astara,,,0,1,1,1,,,,,`).replace('Engineering', 'ENG'));
    const res = await admin.post('/api/v1/consumption/sync');
    expect(res.body.data).toMatchObject({ created: 0, updated: 1, unchanged: 1 });

    const rows = await getDb().collection('consumptions').find({ module: 'FB' }).toArray();
    expect(rows).toHaveLength(1); // updated in place, not duplicated
    expect(rows[0]).toMatchObject({ isMarked: 1 });
    expect(rows[0]).not.toHaveProperty('type');
  });

  it('rejects unknown properties and modules with the row number, and saves the rest', async () => {
    const admin = await signedInAs(app);
    const code = await hotelCode(await createHotel('Astara'));
    serveSheet(sheet(`${code},Astara,,,1,1,,,,,,,`, 'NOPE9,Ghost,,,1,1,1,1,,,,,'));

    const res = await admin.post('/api/v1/consumption/sync');
    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
    const messages = res.body.data.issues.map(
      (i: { row: number; message: string }) => `${i.row}: ${i.message}`,
    );
    expect(messages).toEqual(expect.arrayContaining(['5: Property Code "NOPE9" does not exist']));
    expect(await getDb().collection('consumptions').countDocuments()).toBe(1);
  });

  it('rejects a module that is not in the master', async () => {
    const admin = await signedInAs(app);
    const code = await hotelCode(await createHotel('Astara'));
    serveSheet(sheet(`${code},Astara,,,,,1,1,,,,,`).replace('Engineering', 'Plumbing'));
    const res = await admin.post('/api/v1/consumption/sync');
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.rejected).toBe(1);
    expect(res.body.data.issues[0]).toMatchObject({
      row: 4,
      message: 'Unknown module "Plumbing"',
      cells: 1,
    });
  });

  it('only saves properties the user belongs to', async () => {
    const mine = await createHotel('Mine');
    const other = await createHotel('Other');
    const [mineCode, otherCode] = [await hotelCode(mine), await hotelCode(other)];
    await grant('GM', ['view-consumption', 'add-consumption']);
    const gm = await createUser({ role: 'GM', hotelIds: [mine] });
    const { accessToken } = await login(app, gm.email);
    const auth = { Authorization: `Bearer ${accessToken}` };

    serveSheet(sheet(`${mineCode},Mine,,,1,1,,,,,,,`, `${otherCode},Other,,,1,1,,,,,,,`));
    const res = await request(app).post('/api/v1/consumption/sync').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 1, rejected: 1 });
    expect(res.body.data.issues[0].message).toContain('not one of your properties');
    const saved = await getDb().collection('consumptions').find({}).toArray();
    expect(saved.every((r) => r.propertyCode === mineCode)).toBe(true);
  });

  it('is refused without add-consumption', async () => {
    await grant('GM', ['view-consumption']);
    const gm = await createUser({ role: 'GM', hotelIds: [await createHotel('Mine')] });
    const { accessToken } = await login(app, gm.email);
    serveSheet(sheet());
    const res = await request(app)
      .post('/api/v1/consumption/sync')
      .set({ Authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(403);
    expect(await request(app).post('/api/v1/consumption/sync')).toHaveProperty('status', 401);
  });

  it('gives a clear error when the sheet cannot be read', async () => {
    const admin = await signedInAs(app);
    serveSheet(null); // Google answers with a sign-in page
    const res = await admin.post('/api/v1/consumption/sync');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('SHEET_UNAVAILABLE');
    expect(await getDb().collection('consumptions').countDocuments()).toBe(0);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await admin.post('/api/v1/consumption/sync')).status).toBe(502);
  });
});

describe('consumption reads', () => {
  it('lists the six modules in order', async () => {
    const admin = await signedInAs(app);
    const res = await admin.get('/api/v1/consumption-modules');
    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { code: string }) => m.code)).toEqual([
      'FB',
      'ENG',
      'HK',
      'ELEC',
      'WATER',
      'FUEL',
    ]);
  });

  it('lists rows by day and summarises one day with the Total row, within the user hotels', async () => {
    const admin = await signedInAs(app);
    const a = await hotelCode(await createHotel('Astara'));
    const b = await hotelCode(await createHotel('Brightland'));
    serveSheet(sheet(`${a},Astara,,,1,0,1,1,,1,1,1,1`, `${b},Brightland,,,1,1,0,0,,0,0,0,0`));
    await admin.post('/api/v1/consumption/sync');

    const day = await admin.get('/api/v1/consumption?date=2026-11-17&limit=100');
    expect(day.body.data.total).toBe(4);
    expect(
      day.body.data.items.every((r: { date: string }) => r.date === '2026-11-17T00:00:00.000Z'),
    ).toBe(true);
    const one = await admin.get('/api/v1/consumption?from=2026-11-18&to=2026-11-18&module=ENG');
    expect(one.body.data.total).toBe(2); // ENG on 18-Nov, one per property
  });

  it('summary totals are the sum of the properties', async () => {
    const admin = await signedInAs(app);
    const a = await hotelCode(await createHotel('Astara'));
    const b = await hotelCode(await createHotel('Brightland'));
    serveSheet(sheet(`${a},Astara,,,1,0,1,1,,0,0,0,0`, `${b},Brightland,,,1,1,0,0,,0,0,0,0`));
    await admin.post('/api/v1/consumption/sync');

    const res = await admin.get('/api/v1/consumption/summary?date=2026-11-17');
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.modules.map((m: { code: string }) => m.code)).toContain('FUEL');
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0]).toMatchObject({
      hotelName: 'Astara',
      cells: { FB: 0, ENG: 1 },
    });
    expect(s.totals.FB).toBe(1);
    expect(s.totals.ENG).toBe(1);
    expect(s.totals.FUEL).toBe(0);
  });

  it('shows a user only their own hotels', async () => {
    const admin = await signedInAs(app);
    const mine = await createHotel('Mine');
    const other = await createHotel('Other');
    const [mineCode, otherCode] = [await hotelCode(mine), await hotelCode(other)];
    serveSheet(sheet(`${mineCode},Mine,,,1,1,,,,,,,`, `${otherCode},Other,,,1,1,,,,,,,`));
    await admin.post('/api/v1/consumption/sync');

    await grant('GM', ['view-consumption']);
    const gm = await createUser({ role: 'GM', hotelIds: [mine] });
    const { accessToken } = await login(app, gm.email);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const list = await request(app).get('/api/v1/consumption?date=2026-11-17').set(auth);
    expect(
      list.body.data.items.every((r: { propertyCode: string }) => r.propertyCode === mineCode),
    ).toBe(true);
    expect(list.body.data.total).toBe(1);
    const summary = await request(app).get('/api/v1/consumption/summary?date=2026-11-17').set(auth);
    expect(summary.body.data.rows).toHaveLength(1);
    const forbidden = await request(app).get(`/api/v1/consumption?hotelId=${other}`).set(auth);
    expect(forbidden.status).toBe(403);
    expect((await request(app).get('/api/v1/consumption?date=17-Nov').set(auth)).status).toBe(400);
  });
});
