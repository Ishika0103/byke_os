import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';
import type { User } from './user';

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(2048) }).strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(72),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type AuthTokens = { accessToken: string; refreshToken: string };
export type LoginResponse = AuthTokens & { user: User };
