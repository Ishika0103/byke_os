import { pino } from 'pino';
import { env, isProd } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  // Never write credentials or tokens to logs (Plan 01a §6).
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.hashPassword',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
