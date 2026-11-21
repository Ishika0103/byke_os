import { z } from 'zod';
import { type BaseEntity, listQuerySchema, objectIdSchema } from './common';
import type { RoomTypeSummary } from './room-type';

/** "101", "A-12": 1–10 letters, digits or -, stored uppercase. */
export const roomNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,10}$/, 'Up to 10 letters, digits or -');

const floorSchema = z
  .number()
  .int('Whole number only')
  .min(-5, 'Floor must be -5 or higher')
  .max(200, 'Floor must be 200 or lower');

const notesSchema = z.string().trim().max(500, 'At most 500 characters');

/** Most rooms one bulk add may create. */
export const MAX_BULK_ROOMS = 300;

export const createRoomSchema = z
  .object({
    roomNumber: roomNumberSchema,
    roomTypeId: objectIdSchema,
    floor: floorSchema.nullable().optional(),
    /** Defaults to true. False = staff / owner / store room, left out of inventory. */
    isSellable: z.boolean().optional(),
    notes: notesSchema.nullable().optional(),
    /** Defaults to active. */
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateRoomSchema = z
  .object({
    roomNumber: roomNumberSchema,
    roomTypeId: objectIdSchema,
    floor: floorSchema.nullable(),
    isSellable: z.boolean(),
    notes: notesSchema.nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** Adds rooms `from`…`to` (e.g. 101…120) of one type in one go. */
export const bulkCreateRoomsSchema = z
  .object({
    from: z.number().int('Whole number only').min(1).max(99999),
    to: z.number().int('Whole number only').min(1).max(99999),
    roomTypeId: objectIdSchema,
    floor: floorSchema.nullable().optional(),
    isSellable: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.to >= v.from, { path: ['to'], message: '"To" must be at least "From"' })
  .refine((v) => v.to - v.from + 1 <= MAX_BULK_ROOMS, {
    path: ['to'],
    message: `At most ${MAX_BULK_ROOMS} rooms at a time`,
  });

const intString = z.coerce.number().int().min(-5).max(200);

export const roomListQuerySchema = listQuerySchema
  .extend({
    limit: z.coerce.number().int().min(1).max(MAX_BULK_ROOMS).default(20),
    roomTypeId: objectIdSchema.optional(),
    floor: intString.optional(),
    sort: z.enum(['roomNumber', '-roomNumber', 'floor', 'createdAt']).default('roomNumber'),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type BulkCreateRoomsInput = z.infer<typeof bulkCreateRoomsSchema>;
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;

export type Room = BaseEntity & {
  hotelId: string;
  roomNumber: string;
  roomType: RoomTypeSummary | null;
  floor: number | null;
  isSellable: boolean;
  notes: string | null;
};
