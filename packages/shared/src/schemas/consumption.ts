import { z } from 'zod';
import { type BaseEntity, objectIdSchema } from './common';

/** Plan 12: daily "was it marked?" flags per property, date and consumption module. */

/** 0 = not marked, 1 = marked: the value in the sheet's Consumption column. */
export type IsMarked = 0 | 1;

/** One of the six modules (F&B, Engineering, …) from `consumptionmodulemasters`. */
export type ConsumptionModule = BaseEntity & {
  name: string;
  /** FB, ENG, HK, ELEC, WATER, FUEL. */
  code: string;
  sortOrder: number;
};

export type Consumption = BaseEntity & {
  hotelId: string;
  propertyCode: string;
  /** The calendar day as 00:00 UTC, e.g. "2026-11-17T00:00:00.000Z". Read it in UTC. */
  date: string;
  /** Module code, e.g. "FB". */
  module: string;
  isMarked: IsMarked;
};

const isoDate = z.iso.date('Use a date like 2026-11-17');

export const consumptionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    hotelId: objectIdSchema.optional(),
    /** One day, or a range with from / to. */
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    module: z.string().trim().toUpperCase().max(10).optional(),
  })
  .strict();
export type ConsumptionListQuery = z.infer<typeof consumptionListQuerySchema>;

export const consumptionSummaryQuerySchema = z.object({ date: isoDate }).strict();
export type ConsumptionSummaryQuery = z.infer<typeof consumptionSummaryQuerySchema>;

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

/** `preview=true` checks the sheet and reports, but saves nothing. */
export const consumptionSyncQuerySchema = z
  .object({ preview: booleanString.default(false) })
  .strict();
export type ConsumptionSyncQuery = z.infer<typeof consumptionSyncQuerySchema>;

/** A problem found in the sheet: the row it is on and what is wrong. `cells` = values skipped. */
export type ConsumptionSyncIssue = {
  row: number;
  propertyCode: string;
  message: string;
  cells: number;
};

export type ConsumptionSyncResult = {
  /** False for a preview: nothing was written. */
  saved: boolean;
  created: number;
  updated: number;
  unchanged: number;
  /** Values skipped because of the problems below (not rows). */
  rejected: number;
  /** At most the first 200. */
  issues: ConsumptionSyncIssue[];
};

/** One day for every property the user can see, laid out like the sheet. */
export type ConsumptionSummary = {
  date: string;
  modules: { code: string; name: string }[];
  rows: {
    hotelId: string;
    propertyCode: string;
    hotelName: string;
    /** Per module code; null = not in the sheet for that day. */
    cells: Record<string, IsMarked | null>;
  }[];
  /** Per module code: how many properties marked it (the sheet's Total row). */
  totals: Record<string, number>;
};
