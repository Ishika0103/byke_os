import { z } from 'zod';
import { type BaseEntity, listQuerySchema } from './common';

/** Read-only for now: locations are seeded by a migration (Plan 08). */
export const locationListQuerySchema = listQuerySchema
  .extend({ sort: z.enum(['name', '-name', 'state', '-state']).default('name') })
  .strict();

export type LocationListQuery = z.infer<typeof locationListQuerySchema>;

export type Location = BaseEntity & {
  name: string;
  state: string;
  slug: string;
  /** Byke's own id for the location, if it has one. */
  bykeId: number | null;
};

/** A location as shown on a hotel. */
export type LocationSummary = { id: string; name: string; state: string };

/** "Matheran, Maharashtra" */
export const formatLocation = (loc: { name: string; state: string }) => `${loc.name}, ${loc.state}`;
