import type { IsMarked } from '@byke-os/shared';
import { AppError } from '../../utils/app-error';

/**
 * Plan 12 §4: reads the consumption Google Sheet (exported as CSV) into plain values.
 * No database here, so it is easy to test.
 *
 * Layout (wide): three header rows, then one row per property.
 *   row 1:  Property Details | … | 17-Nov | | | | 18-Nov …     (a date starts each block)
 *   row 2:  Property Code | Property | … | F&B | | Engineering | | …   (module names, each over 2 columns)
 *   row 3:  | | | Issue | Consumption | Issue | Consumption …   (only Consumption is read)
 * Data rows follow; a row starting with "Total" is skipped. A cell is 0 or 1; a blank cell is skipped.
 */

/** The hardcoded sheet (CSV export of the `consumption` tab). It must be shared as "anyone with the link". */
export const CONSUMPTION_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1QDx7W7GuwrLyfePkcVmlWeTZM6MDPlWhBziFRyFRxDg/export?format=csv&gid=1370813837';

export type SheetCell = {
  /** Row number in the sheet (1-based), for messages. */
  row: number;
  propertyCode: string;
  date: Date;
  /** The module label as written in the sheet ("F&B"); matched to the master later. */
  moduleLabel: string;
  isMarked: IsMarked;
};

/** A row the parser itself rejects (before looking at the database). */
export type SheetProblem = { row: number; propertyCode: string; message: string; cells: number };

export type ParsedSheet = { cells: SheetCell[]; problems: SheetProblem[] };

/** Splits CSV text into rows of cells (handles quotes, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  // Drop a byte-order mark if the export has one.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * "17-Nov", "17-Nov-2026", "17 Nov 2026", "2026-11-17" or "17/11/2026" -> that day at 00:00 UTC.
 * A date without a year uses the year of `now`. Returns null if it is not a real date.
 */
export function parseSheetDate(label: string, now: Date): Date | null {
  const text = label.trim();
  let year = now.getUTCFullYear();
  let month: number;
  let day: number;
  let m = /^(\d{1,2})[\s\-/]([A-Za-z]{3,9})(?:[\s\-/,]+(\d{4}))?$/.exec(text);
  if (m) {
    month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    day = Number(m[1]);
    if (m[3]) year = Number(m[3]);
  } else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text))) {
    year = Number(m[1]);
    month = Number(m[2]) - 1;
    day = Number(m[3]);
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text))) {
    day = Number(m[1]);
    month = Number(m[2]) - 1;
    year = Number(m[3]);
  } else {
    return null;
  }
  if (month < 0 || month > 11 || day < 1) return null;
  const date = new Date(Date.UTC(year, month, day));
  // Rejects 31-Feb, which JavaScript would roll into March.
  return date.getUTCMonth() === month && date.getUTCDate() === day ? date : null;
}

/** Each module has an Issue and a Consumption column; only Consumption is used. */
const isConsumption = (label: string) => label.trim().toLowerCase() === 'consumption';
const isTypeLabel = (label: string) =>
  isConsumption(label) || label.trim().toLowerCase() === 'issue';

type Column = {
  index: number;
  date: Date;
  dateLabel: string;
  moduleLabel: string;
};

export function parseConsumptionSheet(csv: string, now = new Date()): ParsedSheet {
  const grid = parseCsv(csv);
  if (grid.length < 4) throw AppError.field('sheet', 'The sheet has no data rows');
  const [dates, modules, types] = grid;
  const width = Math.max(...grid.slice(0, 3).map((r) => r.length));

  // Property Code can be in any of the three header rows.
  let codeCol = -1;
  for (const header of [modules, types, dates]) {
    codeCol = header.findIndex((c) => /^property\s*code$/i.test(c.trim()));
    if (codeCol >= 0) break;
  }
  if (codeCol < 0) throw AppError.field('sheet', 'The sheet has no "Property Code" column');

  // Value columns start at the first Issue / Consumption label.
  const firstValue = types.findIndex((c) => isTypeLabel(c));
  if (firstValue < 0) throw AppError.field('sheet', 'The sheet has no Consumption columns');

  const columns: Column[] = [];
  let date: Date | null = null;
  let dateLabel = '';
  let moduleLabel = '';
  for (let c = firstValue; c < width; c++) {
    const dateCell = (dates[c] ?? '').trim();
    if (dateCell) {
      const parsed = parseSheetDate(dateCell, now);
      if (!parsed) throw AppError.field('sheet', `Column ${c + 1}: "${dateCell}" is not a date`);
      date = parsed;
      dateLabel = dateCell;
      moduleLabel = ''; // a new day starts a new run of modules
    }
    const moduleCell = (modules[c] ?? '').trim();
    if (moduleCell) moduleLabel = moduleCell;
    if (!isConsumption(types[c] ?? '')) continue; // spacer or Issue column
    if (!date) throw AppError.field('sheet', `Column ${c + 1} has no date above it`);
    if (!moduleLabel) throw AppError.field('sheet', `Column ${c + 1} has no module name above it`);
    columns.push({ index: c, date, dateLabel, moduleLabel });
  }

  const cells: SheetCell[] = [];
  const problems: SheetProblem[] = [];
  const seen = new Set<string>();
  for (let r = 3; r < grid.length; r++) {
    const line = grid[r];
    if (line.every((c) => c.trim() === '')) continue;
    // The Total row: "Total" is the first filled label before the value columns.
    if (
      /^total$/i.test(
        line
          .slice(0, firstValue)
          .find((c) => c.trim() !== '')
          ?.trim() ?? '',
      )
    )
      continue;
    const row = r + 1;
    const propertyCode = (line[codeCol] ?? '').trim().toUpperCase();
    const filled = columns.filter((col) => (line[col.index] ?? '').trim() !== '');
    if (!propertyCode) {
      if (filled.length) {
        problems.push({
          row,
          propertyCode,
          message: 'Property Code is empty',
          cells: filled.length,
        });
      }
      continue;
    }
    for (const col of columns) {
      const raw = (line[col.index] ?? '').trim();
      if (raw === '') continue;
      const value = Number(raw);
      if (raw === '' || (value !== 0 && value !== 1)) {
        problems.push({
          row,
          propertyCode,
          message: `${col.moduleLabel} on ${col.dateLabel}: "${raw}" is not 0 or 1`,
          cells: 1,
        });
        continue;
      }
      const key = `${propertyCode}|${col.date.toISOString()}|${col.moduleLabel.toLowerCase()}`;
      if (seen.has(key)) {
        problems.push({
          row,
          propertyCode,
          message: `${col.moduleLabel} on ${col.dateLabel} appears twice for this property`,
          cells: 1,
        });
        continue;
      }
      seen.add(key);
      cells.push({
        row,
        propertyCode,
        date: col.date,
        moduleLabel: col.moduleLabel,
        isMarked: value as IsMarked,
      });
    }
  }
  return { cells, problems };
}

/** Downloads the sheet as CSV text. Fails clearly if it is private or Google is unreachable. */
export async function downloadConsumptionSheet(url = CONSUMPTION_SHEET_URL): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new AppError(502, 'SHEET_UNAVAILABLE', 'Could not reach the Google Sheet. Try again.');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new AppError(
      502,
      'SHEET_UNAVAILABLE',
      'Could not read the Google Sheet. It must be shared as "anyone with the link can view".',
    );
  }
  return res.text();
}
