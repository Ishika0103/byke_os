import { z } from 'zod';
import {
  type BaseEntity,
  emailSchema,
  listQuerySchema,
  nameSchema,
  objectIdSchema,
  passwordSchema,
} from './common';
import type { RoleSummary } from './role';

export const createUserSchema = z
  .object({
    name: nameSchema(2, 80),
    email: emailSchema,
    roleId: objectIdSchema,
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
    roleId: objectIdSchema,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const resetPasswordSchema = z.object({ newPassword: passwordSchema }).strict();

export const userListQuerySchema = listQuerySchema
  .extend({
    roleId: objectIdSchema.optional(),
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
  /** null if the role was deleted after assignment. */
  role: RoleSummary | null;
};
