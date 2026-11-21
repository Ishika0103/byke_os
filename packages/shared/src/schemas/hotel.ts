import { z } from 'zod';
import { type CityLocation, isKnownCity } from '../data/indian-cities';
import { type BaseEntity, listQuerySchema, nameSchema } from './common';

/** Time of day as 24-hour "HH:mm", e.g. "14:00". */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24-hour)');

/** City + state, must be in INDIAN_CITIES. */
export const hotelLocationSchema = z
  .object({ city: z.string().trim(), state: z.string().trim() })
  .strict()
  .refine(isKnownCity, 'Pick a city from the list');

export const createHotelSchema = z
  .object({
    name: nameSchema(2, 100),
    location: hotelLocationSchema,
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
    location: hotelLocationSchema,
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
  })
  .strict();

export type CreateHotelInput = z.infer<typeof createHotelSchema>;
export type UpdateHotelInput = z.infer<typeof updateHotelSchema>;
export type HotelListQuery = z.infer<typeof hotelListQuerySchema>;

export type Hotel = BaseEntity & {
  name: string;
  /** Generated from the name on create, e.g. "BRG"; never changes. */
  code: string;
  location: CityLocation;
  checkInTime: string;
  checkOutTime: string;
};
