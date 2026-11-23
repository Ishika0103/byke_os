import { z } from 'zod';

/** 24-char hex MongoDB ObjectId, as sent over the API. */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/**
 * Password policy (Plan 01a §5.6): 8–72 chars (bcrypt ignores bytes after 72),
 * at least one letter and one number.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email').max(254));

/**
 * Indian mobile number: 10 digits starting 6–9. Spaces, dashes, a +91 / 91 / 0 prefix are accepted
 * and removed, so "+91 98765 43210" is stored as "9876543210".
 */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'));

/** Names: trimmed, no control characters. */
export const nameSchema = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Must be at least ${min} characters`)
    .max(max, `Must be at most ${max} characters`)
    // eslint-disable-next-line no-control-regex
    .regex(/^[^\u0000-\u001f\u007f]*$/, 'Contains invalid characters');

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Query params shared by every list endpoint. */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  isActive: booleanString.optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Fields every entity exposes (Plan 01a §1). */
export type BaseEntity = {
  id: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};
