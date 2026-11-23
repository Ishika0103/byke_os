import { z } from 'zod';
import { permissionsSchema } from '../rbac/permissions';
import { type BaseEntity, listQuerySchema, nameSchema } from './common';

/** Role code of the top-level administrator. Used for the "last Super Admin" safety rule. */
export const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

export const roleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{1,29}$/, 'Code must be 2–30 chars: letters, digits, underscore');

export const createRoleSchema = z
  .object({
    name: nameSchema(2, 50),
    code: roleCodeSchema,
  })
  .strict();

/** `code` is immutable after creation, so it is not accepted here. */
export const updateRoleSchema = z
  .object({
    name: nameSchema(2, 50),
    isActive: z.boolean(),
    /** Super Admin only; the Super Admin role's own permissions can't be changed. */
    permissions: permissionsSchema,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const roleListQuerySchema = listQuerySchema
  .extend({
    sort: z.enum(['name', '-name', 'code', '-code', 'createdAt', '-createdAt']).default('name'),
  })
  .strict();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleListQuery = z.infer<typeof roleListQuerySchema>;

export type Role = BaseEntity & {
  name: string;
  code: string;
  /** Named permissions (Plan 06); Super Admin holds ['*']. */
  permissions: string[];
};

export type RoleSummary = Pick<Role, 'id' | 'name' | 'code'>;
