import { z } from 'zod';

/**
 * Validates process.env once at startup. The app fails fast with a clear
 * message instead of crashing later on a missing variable.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:8081')
      .transform((v) =>
        v
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // Where uploaded photos are saved (Plan 04 §4, Plan 11). 'local' = UPLOAD_DIR on the server's
    // disk (dev and tests); 's3' = an AWS S3 bucket, served from AWS_MEDIA_DOMAIN.
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    AWS_REGION: z.string().optional(),
    AWS_BUCKET_NAME: z.string().optional(),
    // Public base URL of the bucket or its CDN, e.g. https://media.example.com (no trailing slash).
    AWS_MEDIA_DOMAIN: z
      .string()
      .url()
      .transform((v) => v.replace(/\/+$/, ''))
      .optional(),
    // Leave both empty to use the server's IAM role instead of keys.
    AWS_ACCESS_KEY: z.string().optional(),
    AWS_SECRET_KEY: z.string().optional(),

    // Auth (Plan 01a §5, §7)
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),

    // Only used by `npm run seed`
    SEED_ADMIN_NAME: z.string().optional(),
    SEED_ADMIN_EMAIL: z.string().optional(),
    SEED_ADMIN_MOBILE: z.string().optional(),
    SEED_ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.STORAGE_DRIVER !== 's3') return;
    for (const name of ['AWS_REGION', 'AWS_BUCKET_NAME', 'AWS_MEDIA_DOMAIN'] as const) {
      if (!e[name]) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} is required when STORAGE_DRIVER=s3`,
        });
      }
    }
    if (Boolean(e.AWS_ACCESS_KEY) !== Boolean(e.AWS_SECRET_KEY)) {
      ctx.addIssue({
        code: 'custom',
        path: ['AWS_SECRET_KEY'],
        message: 'Set both AWS_ACCESS_KEY and AWS_SECRET_KEY, or neither',
      });
    }
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
    path: ['JWT_REFRESH_SECRET'],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
