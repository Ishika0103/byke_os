import { z } from 'zod';
import { type BaseEntity, listQuerySchema, nameSchema } from './common';

export const createDepartmentSchema = z
  .object({
    name: nameSchema(2, 50),
    /** Defaults to active. */
    isActive: z.boolean().optional(),
  })
  .strict();

/** `code` is generated and immutable, so it is not accepted here. */
export const updateDepartmentSchema = z
  .object({
    name: nameSchema(2, 50),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const departmentListQuerySchema = listQuerySchema
  .extend({
    sort: z.enum(['name', '-name', 'code', '-code', 'createdAt', '-createdAt']).default('name'),
  })
  .strict();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;

export type Department = BaseEntity & {
  name: string;
  /** Generated from the name on create, e.g. "HK"; never changes. */
  code: string;
};

export type DepartmentSummary = { id: string; name: string; code: string };
