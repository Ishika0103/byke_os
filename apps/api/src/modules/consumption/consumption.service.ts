import { Types } from 'mongoose';
import type {
  Consumption,
  ConsumptionListQuery,
  ConsumptionSummary,
  ConsumptionSyncIssue,
  ConsumptionSyncResult,
  IsMarked,
  Paginated,
} from '@byke-os/shared';
import { type LeanBase, toBaseDto } from '../../db/lean-types';
import { AppError } from '../../utils/app-error';
import { HotelModel } from '../hotels/hotel.model';
import { ConsumptionModuleModel } from '../consumption-modules/consumption-module.model';
import { ConsumptionModels, modelFor } from './consumption.model';
import {
  downloadConsumptionSheet,
  parseConsumptionSheet,
  type SheetProblem,
} from './consumption-sheet';

/** The user's hotels; null means every hotel (Super Admin). */
export type HotelScope = string[] | null;

const MAX_ISSUES = 200;
const BATCH = 1000;

type LeanConsumption = LeanBase & {
  hotelId: Types.ObjectId;
  propertyCode: string;
  date: Date;
  module: string;
  isMarked: IsMarked;
};

const toDto = (c: LeanConsumption): Consumption => ({
  ...toBaseDto(c),
  hotelId: String(c.hotelId),
  propertyCode: c.propertyCode,
  date: c.date.toISOString(),
  module: c.module,
  isMarked: c.isMarked,
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const inScope = (scope: HotelScope, hotelId: string) => scope === null || scope.includes(hotelId);

export const consumptionService = {
  /** Rows for the user's hotels, filtered by hotel, a day, a range or a module. */
  async list(query: ConsumptionListQuery, scope: HotelScope): Promise<Paginated<Consumption>> {
    const { page, limit, hotelId, date, from, to, module } = query;
    if (hotelId && !inScope(scope, hotelId)) throw AppError.forbidden('Not one of your properties');

    const filter: Record<string, unknown> = {};
    if (hotelId) filter.hotelId = new Types.ObjectId(hotelId);
    else if (scope !== null) filter.hotelId = { $in: scope.map((id) => new Types.ObjectId(id)) };
    if (date) filter.date = day(date);
    else if (from || to) {
      filter.date = { ...(from && { $gte: day(from) }), ...(to && { $lte: day(to) }) };
    }
    if (module) filter.module = module;

    // One collection per module: ask each one, then merge and page the rows.
    const models = module ? [modelFor(module)].filter(Boolean) : Object.values(ConsumptionModels);
    const parts = await Promise.all(
      models.map(async (m) => ({
        items: await m
          .find(filter)
          .sort({ date: -1, propertyCode: 1, module: 1 })
          .limit(page * limit)
          .lean<LeanConsumption[]>(),
        total: await m.countDocuments(filter),
      })),
    );
    const merged = parts
      .flatMap((p) => p.items)
      .sort(
        (a, b) =>
          b.date.getTime() - a.date.getTime() ||
          a.propertyCode.localeCompare(b.propertyCode) ||
          a.module.localeCompare(b.module),
      )
      .slice((page - 1) * limit, page * limit);
    const total = parts.reduce((n, p) => n + p.total, 0);
    return { items: merged.map(toDto), page, limit, total };
  },

  /** One day for every property the user can see, laid out like the sheet, with its Total row. */
  async summary(date: string, scope: HotelScope): Promise<ConsumptionSummary> {
    const [modules, rows] = await Promise.all([
      ConsumptionModuleModel.find({ isActive: true })
        .sort({ sortOrder: 1 })
        .lean<{ code: string; name: string }[]>(),
      Promise.all(
        Object.values(ConsumptionModels).map((m) =>
          m
            .find({
              date: day(date),
              ...(scope !== null && {
                hotelId: { $in: scope.map((id) => new Types.ObjectId(id)) },
              }),
            })
            .lean<LeanConsumption[]>(),
        ),
      ).then((parts) => parts.flat()),
    ]);
    const hotels = await HotelModel.find({
      _id: { $in: [...new Set(rows.map((r) => String(r.hotelId)))] },
    })
      .select('name code')
      .lean<{ _id: Types.ObjectId; name: string; code: string }[]>();
    const hotelName = new Map(hotels.map((h) => [String(h._id), h.name]));

    const byProperty = new Map<string, ConsumptionSummary['rows'][number]>();
    const totals: ConsumptionSummary['totals'] = Object.fromEntries(
      modules.map((m) => [m.code, 0]),
    );
    for (const r of rows) {
      const key = String(r.hotelId);
      let line = byProperty.get(key);
      if (!line) {
        line = {
          hotelId: key,
          propertyCode: r.propertyCode,
          hotelName: hotelName.get(key) ?? r.propertyCode,
          cells: {},
        };
        byProperty.set(key, line);
      }
      line.cells[r.module] = r.isMarked;
      if (r.module in totals) totals[r.module] += r.isMarked;
    }
    return {
      date: `${date}T00:00:00.000Z`,
      modules: modules.map((m) => ({ code: m.code, name: m.name })),
      rows: [...byProperty.values()].sort((a, b) => a.hotelName.localeCompare(b.hotelName)),
      totals,
    };
  },

  /**
   * Reads the hardcoded Google Sheet and saves it: a row for the same property, date and
   * module is updated, otherwise created. With `preview` nothing is written.
   */
  async sync(
    preview: boolean,
    scope: HotelScope,
    actorId: string,
    download: () => Promise<string> = downloadConsumptionSheet,
  ): Promise<ConsumptionSyncResult> {
    const { cells, problems } = parseConsumptionSheet(await download());
    const issues: ConsumptionSyncIssue[] = problems.map((p: SheetProblem) => ({ ...p }));
    let rejected = problems.reduce((n, p) => n + p.cells, 0);

    // Property codes and modules in the sheet, matched against the database.
    const codes = [...new Set(cells.map((c) => c.propertyCode))];
    const hotels = await HotelModel.find({ code: { $in: codes } })
      .select('code')
      .lean<{ _id: Types.ObjectId; code: string }[]>();
    const hotelByCode = new Map(hotels.map((h) => [h.code.toUpperCase(), String(h._id)]));

    const modules = await ConsumptionModuleModel.find({ isActive: true }).lean<
      { name: string; code: string }[]
    >();
    const moduleByLabel = new Map<string, string>();
    for (const m of modules) {
      moduleByLabel.set(m.name.toLowerCase(), m.code);
      moduleByLabel.set(m.code.toLowerCase(), m.code);
    }

    type Ready = {
      hotelId: string;
      propertyCode: string;
      date: Date;
      module: string;
      isMarked: IsMarked;
    };
    const ready: Ready[] = [];
    const reject = (row: number, propertyCode: string, message: string) => {
      rejected++;
      const last = issues[issues.length - 1];
      // One line per row and reason, not one per skipped value.
      if (last && last.row === row && last.message === message) last.cells++;
      else issues.push({ row, propertyCode, message, cells: 1 });
    };
    for (const c of cells) {
      const hotelId = hotelByCode.get(c.propertyCode);
      if (!hotelId) {
        reject(c.row, c.propertyCode, `Property Code "${c.propertyCode}" does not exist`);
        continue;
      }
      if (!inScope(scope, hotelId)) {
        reject(c.row, c.propertyCode, `"${c.propertyCode}" is not one of your properties`);
        continue;
      }
      const module = moduleByLabel.get(c.moduleLabel.toLowerCase());
      if (!module) {
        reject(c.row, c.propertyCode, `Unknown module "${c.moduleLabel}"`);
        continue;
      }
      if (!modelFor(module)) {
        reject(c.row, c.propertyCode, `Module "${c.moduleLabel}" is not tracked yet`);
        continue;
      }
      ready.push({
        hotelId,
        propertyCode: c.propertyCode,
        date: c.date,
        module,
        isMarked: c.isMarked,
      });
    }

    // What is stored already, to tell new from changed from unchanged.
    const existing = new Map<string, IsMarked>();
    if (ready.length) {
      const times = ready.map((r) => r.date.getTime());
      const hotelIds = [...new Set(ready.map((r) => r.hotelId))].map(
        (id) => new Types.ObjectId(id),
      );
      const range = { $gte: new Date(Math.min(...times)), $lte: new Date(Math.max(...times)) };
      const used = [...new Set(ready.map((r) => r.module))];
      const stored = (
        await Promise.all(
          used.map((code) =>
            modelFor(code)
              .find({ hotelId: { $in: hotelIds }, date: range })
              .select('hotelId date module isMarked')
              .lean<LeanConsumption[]>(),
          ),
        )
      ).flat();
      for (const s of stored) {
        existing.set(`${s.hotelId}|${s.date.toISOString()}|${s.module}`, s.isMarked);
      }
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const toWrite: Ready[] = [];
    for (const r of ready) {
      const before = existing.get(`${r.hotelId}|${r.date.toISOString()}|${r.module}`);
      if (before === undefined) {
        created++;
        toWrite.push(r);
      } else if (before !== r.isMarked) {
        updated++;
        toWrite.push(r);
      } else {
        unchanged++;
      }
    }

    if (!preview) {
      for (const code of new Set(toWrite.map((r) => r.module))) {
        const rows = toWrite.filter((r) => r.module === code);
        for (let i = 0; i < rows.length; i += BATCH) {
          await modelFor(code).bulkWrite(
            rows.slice(i, i + BATCH).map((r) => ({
              updateOne: {
                filter: {
                  hotelId: new Types.ObjectId(r.hotelId),
                  date: r.date,
                  module: r.module,
                  isDeleted: false,
                },
                update: {
                  $set: { isMarked: r.isMarked, propertyCode: r.propertyCode, updatedBy: actorId },
                  $setOnInsert: { isActive: true, createdBy: actorId },
                },
                upsert: true,
              },
            })),
          );
        }
      }
    }

    return {
      saved: !preview,
      created,
      updated,
      unchanged,
      rejected,
      issues: issues.sort((a, b) => a.row - b.row).slice(0, MAX_ISSUES),
    };
  },
};
