import { z } from 'zod';
import { type BaseEntity, listQuerySchema, nameSchema } from './common';

/** Optional room type code in the PMS (Trustify), used to match imported data. */
const pmsCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{1,20}$/, 'Up to 20 letters, digits, - or _');

/** Standard cleaning time in minutes. */
const cleaningMinutesSchema = z
  .number()
  .int('Whole minutes only')
  .min(5, 'At least 5 minutes')
  .max(240, 'At most 240 minutes');

export const createRoomTypeSchema = z
  .object({
    name: nameSchema(2, 50),
    pmsCode: pmsCodeSchema.nullable().optional(),
    cleaningMinutes: cleaningMinutesSchema.nullable().optional(),
    /** Defaults to active. */
    isActive: z.boolean().optional(),
  })
  .strict();

/** `code` is generated and immutable, so it is not accepted here. */
export const updateRoomTypeSchema = z
  .object({
    name: nameSchema(2, 50),
    pmsCode: pmsCodeSchema.nullable(),
    cleaningMinutes: cleaningMinutesSchema.nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const roomTypeListQuerySchema = listQuerySchema
  .extend({
    sort: z.enum(['name', '-name', 'code', '-code', 'createdAt', '-createdAt']).default('name'),
  })
  .strict();

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
export type RoomTypeListQuery = z.infer<typeof roomTypeListQuerySchema>;

export type RoomType = BaseEntity & {
  hotelId: string;
  name: string;
  /** Generated from the name on create, e.g. "DLX"; never changes. */
  code: string;
  pmsCode: string | null;
  cleaningMinutes: number | null;
  /** Number of rooms of this type (not stored; counted from rooms). */
  roomCount: number;
};

export type RoomTypeSummary = Pick<RoomType, 'id' | 'name' | 'code'>;
