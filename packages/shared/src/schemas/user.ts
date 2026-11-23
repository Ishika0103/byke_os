import { z } from 'zod';
import {
  type BaseEntity,
  emailSchema,
  listQuerySchema,
  mobileSchema,
  nameSchema,
  objectIdSchema,
  passwordSchema,
} from './common';
import type { DepartmentSummary } from './department';
import type { HotelSummary } from './hotel';
import type { RoleSummary } from './role';

/** Hotels a user works at (Plan 05). Required unless the role is Super Admin; checked by the API. */
export const MAX_USER_HOTELS = 100;
const hotelIdsSchema = z.array(objectIdSchema).max(MAX_USER_HOTELS);

/** Departments a user belongs to (Plan 09 §6): at least one, for every role. */
const departmentIdsSchema = z
  .array(objectIdSchema)
  .min(1, 'Choose at least one department')
  .max(50);

export const createUserSchema = z
  .object({
    name: nameSchema(2, 80),
    email: emailSchema,
    mobile: mobileSchema,
    roleId: objectIdSchema,
    hotelIds: hotelIdsSchema.default([]),
    departmentIds: departmentIdsSchema,
    password: passwordSchema,
  })
  .strict()
  .refine((v) => v.password.toLowerCase() !== v.email, {
    message: 'Password must not be the same as the email',
    path: ['password'],
  });

/** Passwords are never changed through this schema (see reset / change password). */
export const updateUserSchema = z
  .object({
    name: nameSchema(2, 80),
    email: emailSchema,
    mobile: mobileSchema,
    roleId: objectIdSchema,
    hotelIds: hotelIdsSchema,
    departmentIds: departmentIdsSchema,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const resetPasswordSchema = z.object({ newPassword: passwordSchema }).strict();

export const userListQuerySchema = listQuerySchema
  .extend({
    roleId: objectIdSchema.optional(),
    hotelId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    sort: z.enum(['name', '-name', 'email', '-email', 'createdAt', '-createdAt']).default('name'),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export type User = BaseEntity & {
  name: string;
  email: string;
  /** 10-digit mobile number; null for users created before it was asked for. */
  mobile: string | null;
  /** null if the role was deleted after assignment. */
  role: RoleSummary | null;
  /** Hotels the user is mapped to (empty for Super Admin, who sees every hotel). */
  hotels: HotelSummary[];
  /** Departments the user belongs to (empty only for users created before Plan 09). */
  departments: DepartmentSummary[];
  /** The user's role permissions (Plan 06), for hiding buttons in the app. */
  permissions: string[];
};
