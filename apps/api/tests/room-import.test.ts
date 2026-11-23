import ExcelJS from 'exceljs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createHotel, grant, signedInAs, useTestDatabase } from './helpers';

useTestDatabase();

const app = createApp();
type Admin = Awaited<ReturnType<typeof signedInAs>>;

/** Hotel with two room types (DLX = Deluxe Room, ST = Suite). */
async function setup() {
  const admin = await signedInAs(app);
  const hotelRes = await admin.post('/api/v1/hotels', {
    name: 'Astara',
    locationId: (await admin.get('/api/v1/locations?q=matheran')).body.data.items[0].id,
    checkInTime: '14:00',
    checkOutTime: '11:00',
  });
  const hotelId = hotelRes.body.data.id as string;
  const dlx = await admin.post(`/api/v1/hotels/${hotelId}/room-types`, { name: 'Deluxe Room' });
  const st = await admin.post(`/api/v1/hotels/${hotelId}/room-types`, { name: 'Suite' });
  return {
    admin,
    hotelId,
    hotelCode: hotelRes.body.data.code as string,
    dlx: dlx.body.data as { id: string; code: string },
    st: st.body.data as { id: string; code: string },
  };
}

/** Builds an .xlsx like the sample: columns Hotel Code, Room Type Code, Room Number. */
async function xlsx(
  rows: (string | number | null)[][],
  header: string[] = ['Hotel Code', 'Room Type Code', 'Room Number'],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rooms');
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const base = (hotelId: string) => `/api/v1/hotels/${hotelId}/rooms`;

function upload(
  admin: Admin,
  hotelId: string,
  step: 'preview' | 'commit' | 'rejected',
  file: Buffer,
) {
  return request(app)
    .post(`${base(hotelId)}/import/${step}`)
    .set(admin.auth)
    .attach('file', file, { filename: 'rooms.xlsx' });
}

async function readSheet(buffer: Buffer, name: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(name)!;
  return ws.getSheetValues().slice(1) as unknown[][];
}

describe('rooms Excel import (Plan 07)', () => {
  it('sample: this hotel code on every row, room types listed', async () => {
    const { admin, hotelId, hotelCode, dlx } = await setup();
    const res = await request(app)
      .get(`${base(hotelId)}/import/sample`)
      .set(admin.auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const rooms = await readSheet(res.body as Buffer, 'Rooms');
    expect(rooms[0]).toEqual(
      expect.arrayContaining(['Hotel Code', 'Room Type Code', 'Room Number']),
    );
    expect(rooms[1][1]).toBe(hotelCode);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Instructions', 'Rooms']);
    const help = (await readSheet(res.body as Buffer, 'Instructions')).map((r) => String(r[1]));
    expect(help).toContain(`${dlx.code} = Deluxe Room`);
    expect(wb.getWorksheet('Rooms')!.getCell('B2').dataValidation.formulae?.[0]).toContain(
      dlx.code,
    );
  });

  it('preview saves nothing; commit creates; the same file again changes nothing', async () => {
    const { admin, hotelId, hotelCode, dlx, st } = await setup();
    const file = await xlsx([
      [hotelCode, dlx.code, '101'],
      [hotelCode, dlx.code, 102],
      [hotelCode, st.code, '201'],
    ]);

    const preview = await upload(admin, hotelId, 'preview', file);
    expect(preview.status).toBe(200);
    expect(preview.body.data.counts).toEqual({ create: 3, update: 0, unchanged: 0, rejected: 0 });
    expect((await admin.get(base(hotelId))).body.data.total).toBe(0);

    const commit = await upload(admin, hotelId, 'commit', file);
    expect(commit.body.data).toMatchObject({ created: 3, updated: 0, rejected: 0 });
    const list = (await admin.get(base(hotelId))).body.data.items as {
      roomNumber: string;
      isActive: boolean;
      roomType: { code: string };
      createdBy: string;
    }[];
    expect(list.map((r) => r.roomNumber)).toEqual(['101', '102', '201']);
    expect(list.every((r) => r.isActive)).toBe(true); // new rooms are active
    expect(list[2].roomType.code).toBe(st.code);
    expect(list[0].createdBy).toBe(admin.user.id);

    const again = await upload(admin, hotelId, 'commit', file);
    expect(again.body.data).toMatchObject({ created: 0, updated: 0, unchanged: 3 });
    expect((await admin.get(base(hotelId))).body.data.total).toBe(3);
  });

  it('changes the room type of an existing room and leaves its status alone', async () => {
    const { admin, hotelId, hotelCode, dlx, st } = await setup();
    await upload(admin, hotelId, 'commit', await xlsx([[hotelCode, dlx.code, '101']]));
    const room0 = (await admin.get(base(hotelId))).body.data.items[0];
    await admin.patch(`${base(hotelId)}/${room0.id}`, { isActive: false });
    const res = await upload(admin, hotelId, 'commit', await xlsx([[hotelCode, st.code, '101']]));
    expect(res.body.data).toMatchObject({ created: 0, updated: 1 });
    const room = (await admin.get(base(hotelId))).body.data.items[0];
    expect(room.roomType.code).toBe(st.code);
    expect(room.isActive).toBe(false); // the import never changes status
  });

  it('saves the valid rows and reports each bad row with its reason', async () => {
    const { admin, hotelId, hotelCode, dlx } = await setup();
    await admin.post(`/api/v1/hotels/${hotelId}/room-types`, { name: 'Old', isActive: false });
    const inactive = (await admin.get(`/api/v1/hotels/${hotelId}/room-types?q=old`)).body.data
      .items[0];
    const file = await xlsx([
      [hotelCode, dlx.code, '101', null], // ok
      [hotelCode, 'NOPE', '102', null], // unknown room type
      [hotelCode, dlx.code, 'TOO-LONG-ROOM', null], // too long
      [hotelCode, dlx.code, '101', null], // repeated
      ['OTHER', dlx.code, '103', null], // another hotel's code
      [hotelCode, inactive.code, '105', null], // inactive type
      [hotelCode, dlx.code, null, null], // blank row, ignored
      [hotelId, dlx.id, '106', null], // raw ids are accepted for the room type
    ]);
    const res = await upload(admin, hotelId, 'commit', file);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 2, rejected: 5 });
    const reasons = (res.body.data.rejectedRows as { errors: string[] }[]).map((r) =>
      r.errors.join(' '),
    );
    expect(reasons[0]).toMatch(/not found in this hotel/);
    expect(reasons[1]).toMatch(/Room Number/);
    expect(reasons[2]).toMatch(/repeated/);
    expect(reasons[3]).toMatch(/not this hotel/);
    expect(reasons[4]).toMatch(/inactive/);
    expect((await admin.get(base(hotelId))).body.data.total).toBe(2);
  });

  it('a room type from another hotel is not accepted', async () => {
    const { admin, hotelId, hotelCode } = await setup();
    const other = await createHotel('Other');
    const type = await admin.post(`/api/v1/hotels/${other}/room-types`, { name: 'Villa' });
    const res = await upload(
      admin,
      hotelId,
      'preview',
      await xlsx([[hotelCode, type.body.data.code, '101', null]]),
    );
    expect(res.body.data.counts.rejected).toBe(1);
  });

  it('downloads the rejected rows with a Reason column', async () => {
    const { admin, hotelId, hotelCode, dlx } = await setup();
    const file = await xlsx([
      [hotelCode, dlx.code, '101', null],
      [hotelCode, 'NOPE', '102', null],
    ]);
    const res = await request(app)
      .post(`${base(hotelId)}/import/rejected`)
      .set(admin.auth)
      .attach('file', file, { filename: 'rooms.xlsx' })
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const rows = await readSheet(res.body as Buffer, 'Rooms');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Reason');
    expect(String(rows[1][4])).toMatch(/NOPE/);
  });

  it('rejects bad files with a clear message', async () => {
    const { admin, hotelId } = await setup();
    const notExcel = await upload(admin, hotelId, 'preview', Buffer.from('hello,world'));
    expect(notExcel.status).toBe(400);
    expect(notExcel.body.error.details.file[0]).toMatch(/Excel/);

    const noFile = await request(app)
      .post(`${base(hotelId)}/import/preview`)
      .set(admin.auth);
    expect(noFile.status).toBe(400);

    const missingColumns = await upload(admin, hotelId, 'preview', await xlsx([['a']], ['Foo']));
    expect(missingColumns.status).toBe(400);
    expect(missingColumns.body.error.details.file[0]).toMatch(/Room Number/);

    const empty = await upload(admin, hotelId, 'preview', await xlsx([]));
    expect(empty.status).toBe(400);
  });

  it('exports the hotel’s rooms in the same layout, and importing that file changes nothing', async () => {
    const { admin, hotelId, hotelCode, dlx } = await setup();
    await upload(
      admin,
      hotelId,
      'commit',
      await xlsx([
        [hotelCode, dlx.code, '101', null],
        [hotelCode, dlx.code, '9', null],
      ]),
    );
    const res = await request(app)
      .get(`${base(hotelId)}/export`)
      .set(admin.auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const rows = await readSheet(res.body as Buffer, 'Rooms');
    expect(rows.map((r) => r[3])).toEqual(['Room Number', '9', '101']); // natural order
    const again = await upload(admin, hotelId, 'preview', res.body as Buffer);
    expect(again.body.data.counts).toEqual({ create: 0, update: 0, unchanged: 2, rejected: 0 });
  });

  it('needs add-room to import (edit-room to update, view-room to export) and hotel access', async () => {
    const { admin, hotelId, hotelCode, dlx, st } = await setup();
    const file = await xlsx([[hotelCode, dlx.code, '101', null]]);
    await upload(admin, hotelId, 'commit', file);
    const change = await xlsx([[hotelCode, st.code, '101', null]]);

    const gm = await signedInAs(app, 'GM', [hotelId]);
    expect((await upload(gm, hotelId, 'preview', file)).status).toBe(403);
    expect((await gm.get(`${base(hotelId)}/export`)).status).toBe(403);

    await grant('GM', ['view-room', 'add-room']);
    expect((await gm.get(`${base(hotelId)}/export`)).status).toBe(200);
    const noEdit = await upload(gm, hotelId, 'commit', change);
    expect(noEdit.body.data).toMatchObject({ updated: 0, rejected: 1 });
    expect(noEdit.body.data.rejectedRows[0].errors[0]).toMatch(/permission/);

    await grant('GM', ['view-room', 'add-room', 'edit-room']);
    expect((await upload(gm, hotelId, 'commit', change)).body.data.updated).toBe(1);

    const stranger = await signedInAs(app, 'GM', [await createHotel('Elsewhere')]);
    expect((await upload(stranger, hotelId, 'preview', file)).status).toBe(403);
  });
});
