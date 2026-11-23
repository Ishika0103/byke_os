import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { roomNumberSchema } from '@byke-os/shared';
import { AppError } from '../../utils/app-error';
import { HotelModel } from '../hotels/hotel.model';
import { RoomTypeModel } from '../room-types/room-type.model';
import { NATURAL_ORDER, RoomModel } from './room.model';

/** Plan 07: rooms Excel import / export for one hotel. */

export const MAX_IMPORT_ROWS = 2000;

const ROOMS_SHEET = 'Rooms';
const HEADERS = ['Hotel Code', 'Room Type Code', 'Room Number'] as const;
const SAMPLE_ROWS = 300;

export type ImportAction = 'create' | 'update' | 'unchanged' | 'rejected';

export type ImportRow = {
  /** Row number in the Excel file. */
  row: number;
  hotelCode: string;
  roomTypeCode: string;
  roomNumber: string;
  action: ImportAction;
  errors: string[];
};

export type ImportPreview = {
  counts: Record<ImportAction, number>;
  rows: ImportRow[];
};

type TypeInfo = { id: string; code: string; name: string; isActive: boolean };

// ---------- reading the file ----------

/** Lookup key for a room type: codes are upper case, raw ids stay as they are (lower case). */
const typeKey = (v: string) => (/^[a-fd]{24}$/i.test(v) ? v.toLowerCase() : v.toUpperCase());

function cellText(cell: ExcelJS.Cell): string {
  // Formulas are never evaluated; their cached result is read as plain text.
  return String(cell.text ?? '').trim();
}

async function loadSheet(buffer: Buffer | undefined) {
  if (!buffer || buffer.length === 0) throw AppError.field('file', 'Choose an Excel file');
  // .xlsx is a zip file: starts with "PK". Checked by content, not by the file name.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw AppError.field('file', 'This is not an Excel (.xlsx) file');
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw AppError.field('file', 'This file could not be read as an Excel (.xlsx) file');
  }
  const sheet = workbook.getWorksheet(ROOMS_SHEET) ?? workbook.worksheets[0];
  if (!sheet) throw AppError.field('file', 'The file has no sheets');
  return sheet;
}

/** Column number for each header (case and spacing ignored). */
function headerColumns(sheet: ExcelJS.Worksheet) {
  const found = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    found.set(cellText(cell).toLowerCase().replace(/\s+/g, ' '), col);
  });
  const col = (name: string) => found.get(name.toLowerCase());
  const roomNumber = col('Room Number');
  const roomType = col('Room Type Code');
  if (!roomNumber || !roomType) {
    throw AppError.field(
      'file',
      'Columns "Room Number" and "Room Type Code" are needed in the first row. Download the sample file.',
    );
  }
  return {
    hotelCode: col('Hotel Code'),
    roomType,
    roomNumber,
  };
}

// ---------- checking the rows ----------

async function analyse(
  hotelId: string,
  buffer: Buffer | undefined,
  canEdit: boolean,
): Promise<ImportPreview> {
  const sheet = await loadSheet(buffer);
  const cols = headerColumns(sheet);

  const [hotel, types, existing] = await Promise.all([
    HotelModel.findById(hotelId).select('code').lean<{ code: string }>(),
    RoomTypeModel.find({ hotelId })
      .select('code name isActive')
      .lean<{ _id: Types.ObjectId; code: string; name: string; isActive: boolean }[]>(),
    RoomModel.find({ hotelId })
      .select('roomNumber roomTypeId isActive')
      .lean<
        { _id: Types.ObjectId; roomNumber: string; roomTypeId: Types.ObjectId; isActive: boolean }[]
      >(),
  ]);
  if (!hotel) throw AppError.notFound('Hotel not found');

  const typeByCode = new Map<string, TypeInfo>();
  for (const t of types) {
    const info = { id: String(t._id), code: t.code, name: t.name, isActive: t.isActive };
    typeByCode.set(typeKey(t.code), info);
    typeByCode.set(typeKey(info.id), info);
  }
  const roomByNumber = new Map(existing.map((r) => [r.roomNumber, r]));

  const rows: ImportRow[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const roomNumberRaw = cellText(row.getCell(cols.roomNumber));
    // A row without a room number is a blank row (the sample comes with codes pre-filled).
    if (!roomNumberRaw) continue;
    if (++dataRows > MAX_IMPORT_ROWS) {
      throw AppError.field('file', `At most ${MAX_IMPORT_ROWS} rooms per file`);
    }

    const hotelCode = cols.hotelCode ? cellText(row.getCell(cols.hotelCode)) : '';
    const roomTypeCode = cellText(row.getCell(cols.roomType));
    const errors: string[] = [];

    const number = roomNumberSchema.safeParse(roomNumberRaw);
    if (!number.success) errors.push(`Room Number: ${number.error.issues[0].message}`);
    const roomNumber = number.success ? number.data : roomNumberRaw.toUpperCase();

    if (hotelCode && hotelCode.toUpperCase() !== hotel.code && hotelCode !== hotelId) {
      errors.push(`Hotel Code: "${hotelCode}" is not this hotel (${hotel.code})`);
    }

    const type = roomTypeCode ? typeByCode.get(typeKey(roomTypeCode)) : undefined;
    if (!roomTypeCode) errors.push('Room Type Code: required');
    else if (!type) errors.push(`Room Type Code: "${roomTypeCode}" not found in this hotel`);

    if (number.success) {
      const first = seen.get(roomNumber);
      if (first) errors.push(`Room Number: "${roomNumber}" is repeated (see row ${first})`);
      else seen.set(roomNumber, r);
    }

    let action: ImportAction = 'rejected';
    if (errors.length === 0 && type) {
      const room = roomByNumber.get(roomNumber);
      if (!room) {
        if (!type.isActive) errors.push(`Room Type Code: "${type.code}" is inactive`);
        else action = 'create';
      } else {
        const typeChanged = String(room.roomTypeId) !== type.id;
        if (!typeChanged) action = 'unchanged';
        else if (!canEdit) errors.push("You don't have permission to edit existing rooms");
        else if (typeChanged && !type.isActive) {
          errors.push(`Room Type Code: "${type.code}" is inactive`);
        } else action = 'update';
      }
    }

    rows.push({
      row: r,
      hotelCode,
      roomTypeCode,
      roomNumber: roomNumberRaw,
      action,
      errors,
    });
  }

  if (rows.length === 0)
    throw AppError.field('file', 'No rooms found. Fill the Room Number column.');

  const counts = { create: 0, update: 0, unchanged: 0, rejected: 0 };
  for (const r of rows) counts[r.action]++;
  return { counts, rows };
}

// ---------- the five operations ----------

function toRejectedWorkbook(rows: ImportRow[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ROOMS_SHEET);
  ws.addRow([...HEADERS, 'Reason']).font = { bold: true };
  for (const r of rows) {
    ws.addRow([r.hotelCode, r.roomTypeCode, r.roomNumber, r.errors.join('; ')]);
  }
  ws.getColumn(3).numFmt = '@';
  ws.columns.forEach((c) => (c.width = 20));
  ws.getColumn(5).width = 70;
  return wb;
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const roomImportService = {
  /** Sample file for one hotel: its code on every row, its room type codes in a dropdown. */
  async sample(hotelId: string, roomTypeId?: string): Promise<Buffer> {
    const hotel = await HotelModel.findById(hotelId).select('code name').lean<{
      code: string;
      name: string;
    }>();
    if (!hotel) throw AppError.notFound('Hotel not found');
    const types = await RoomTypeModel.find({ hotelId, isActive: true })
      .sort({ name: 1 })
      .select('code name')
      .lean<{ _id: Types.ObjectId; code: string; name: string }[]>();
    let prefill = '';
    if (roomTypeId) {
      const t = types.find((x) => String(x._id) === roomTypeId);
      if (!t) throw AppError.field('roomTypeId', 'Room type not found in this hotel');
      prefill = t.code;
    }

    const wb = new ExcelJS.Workbook();
    const help = wb.addWorksheet('Instructions');
    [
      [`Rooms for ${hotel.name} (${hotel.code})`],
      [],
      ['1. Type the room numbers in the "Room Number" column of the Rooms sheet.'],
      ['2. Pick the "Room Type Code" from the dropdown (codes and names are listed below).'],
      ['3. Leave "Hotel Code" as it is. Rows without a room number are ignored.'],
      ['4. Upload the file in the app, check the preview, then confirm.'],
      ['Uploading an existing room number updates that room instead of adding a duplicate.'],
      [],
      ['Room Type Code = Room Type Name'],
      ...types.map((t) => [`${t.code} = ${t.name}`]),
    ].forEach((r) => help.addRow(r));
    help.getRow(1).font = { bold: true, size: 14 };
    help.getColumn(1).width = 90;

    const ws = wb.addWorksheet(ROOMS_SHEET);
    ws.addRow([...HEADERS]).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 20));
    ws.getColumn(3).numFmt = '@';
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    // The dropdown holds the codes directly (Excel limits an inline list to 255 characters).
    const typeList = types.map((t) => t.code).join(',');
    const typeDropdown = typeList && typeList.length <= 250 ? [`"${typeList}"`] : null;
    for (let r = 2; r <= SAMPLE_ROWS + 1; r++) {
      ws.getCell(r, 1).value = hotel.code;
      if (prefill) ws.getCell(r, 2).value = prefill;
      ws.getCell(r, 3).numFmt = '@';
      if (typeDropdown) {
        ws.getCell(r, 2).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: typeDropdown,
        };
      }
    }

    return toBuffer(wb);
  },

  /** The hotel's rooms in the same layout (Room Type Name is for reading only). */
  async export(hotelId: string, roomTypeId?: string): Promise<Buffer> {
    const hotel = await HotelModel.findById(hotelId).select('code').lean<{ code: string }>();
    if (!hotel) throw AppError.notFound('Hotel not found');
    const [types, rooms] = await Promise.all([
      RoomTypeModel.find({ hotelId })
        .select('code name')
        .lean<{ _id: Types.ObjectId; code: string; name: string }[]>(),
      RoomModel.find({ hotelId, ...(roomTypeId && { roomTypeId }) })
        .collation(NATURAL_ORDER)
        .sort({ roomNumber: 1 })
        .select('roomNumber roomTypeId isActive')
        .lean<{ roomNumber: string; roomTypeId: Types.ObjectId; isActive: boolean }[]>(),
    ]);
    const byId = new Map(types.map((t) => [String(t._id), t]));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(ROOMS_SHEET);
    ws.addRow([...HEADERS, 'Room Type Name']).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 20));
    ws.getColumn(3).numFmt = '@';
    for (const r of rooms) {
      const t = byId.get(String(r.roomTypeId));
      ws.addRow([hotel.code, t?.code ?? '', r.roomNumber, t?.name ?? '']);
    }
    return toBuffer(wb);
  },

  /** Checks the file and says what would happen; saves nothing. */
  preview(hotelId: string, buffer: Buffer | undefined, canEdit: boolean) {
    return analyse(hotelId, buffer, canEdit);
  },

  /** Checks the file again and saves every valid row, one by one. */
  async commit(hotelId: string, buffer: Buffer | undefined, actorId: string, canEdit: boolean) {
    const { rows } = await analyse(hotelId, buffer, canEdit);
    const types = await RoomTypeModel.find({ hotelId })
      .select('code')
      .lean<{ _id: Types.ObjectId; code: string }[]>();
    const typeId = new Map(
      types.flatMap((t) => [
        [typeKey(t.code), t._id] as const,
        [typeKey(String(t._id)), t._id] as const,
      ]),
    );

    for (const r of rows) {
      if (r.action !== 'create' && r.action !== 'update') continue;
      const roomNumber = r.roomNumber.toUpperCase();
      const roomTypeId = typeId.get(typeKey(r.roomTypeCode))!;
      try {
        if (r.action === 'create') {
          await RoomModel.create({
            hotelId,
            roomNumber,
            roomTypeId,
            createdBy: actorId,
            updatedBy: actorId,
          });
        } else {
          await RoomModel.updateOne({ hotelId, roomNumber }, { roomTypeId, updatedBy: actorId });
        }
      } catch {
        // e.g. the same number was added by someone else a moment ago.
        r.action = 'rejected';
        r.errors.push('Could not be saved (the room may have just been added)');
      }
    }

    const counts = { create: 0, update: 0, unchanged: 0, rejected: 0 };
    for (const r of rows) counts[r.action]++;
    return {
      created: counts.create,
      updated: counts.update,
      unchanged: counts.unchanged,
      rejected: counts.rejected,
      rejectedRows: rows.filter((r) => r.action === 'rejected'),
    };
  },

  /** The rejected rows with a Reason column, to fix and upload again. */
  async rejected(hotelId: string, buffer: Buffer | undefined, canEdit: boolean) {
    const { rows } = await analyse(hotelId, buffer, canEdit);
    return toBuffer(toRejectedWorkbook(rows.filter((r) => r.action === 'rejected')));
  },
};
