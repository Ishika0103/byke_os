import { z } from 'zod';
import { type BaseEntity, listQuerySchema, nameSchema, objectIdSchema } from './common';
import type { LocationSummary } from './location';

/** Time of day as 24-hour "HH:mm", e.g. "14:00". */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24-hour)');

export const createHotelSchema = z
  .object({
    name: nameSchema(2, 100),
    locationId: objectIdSchema,
    checkInTime: timeOfDaySchema,
    checkOutTime: timeOfDaySchema,
    /** Defaults to active. */
    isActive: z.boolean().optional(),
  })
  .strict();

/** `code` is generated and immutable, so it is not accepted here. */
export const updateHotelSchema = z
  .object({
    name: nameSchema(2, 100),
    locationId: objectIdSchema,
    checkInTime: timeOfDaySchema,
    checkOutTime: timeOfDaySchema,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const hotelListQuerySchema = listQuerySchema
  .extend({
    sort: z.enum(['name', '-name', 'code', '-code', 'createdAt', '-createdAt']).default('name'),
    locationId: objectIdSchema.optional(),
  })
  .strict();

export type CreateHotelInput = z.infer<typeof createHotelSchema>;
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;
export type HotelListQuery = z.infer<typeof hotelListQuerySchema>;

export type Hotel = BaseEntity & {
  name: string;
  /** Generated from the name on create, e.g. "BRG"; never changes. */
  code: string;
  location: LocationSummary;
  checkInTime: string;
  checkOutTime: string;
};

/** A hotel as shown on other records (e.g. a user's hotels). */
export type HotelSummary = { id: string; name: string; code: string };
