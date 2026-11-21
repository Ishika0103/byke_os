import { Router } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import { changePasswordSchema, loginSchema, refreshSchema } from '@byke-os/shared';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import { AppError } from '../../utils/app-error';
import { authController } from './auth.controller';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const limiterDefaults: Partial<Options> = {
  windowMs: FIFTEEN_MINUTES,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Only failed attempts count, so normal users are never limited.
  skipSuccessfulRequests: true,
  handler: (_req, _res, next) =>
    next(AppError.tooManyRequests('Too many login attempts, please try again later')),
};

/**
 * Built per app instance so each instance (and each test) gets its own rate-limit counters.
 * Brute-force protection (Plan 01a §6): 10 failures / 15 min per IP, 5 per email.
 */
export function buildAuthRouter() {
  const router = Router();

  const loginPerIp = rateLimit({ ...limiterDefaults, limit: 10 });
  const loginPerEmail = rateLimit({
    ...limiterDefaults,
    limit: 5,
    keyGenerator: (req) => `email:${String(req.body?.email ?? '')}`,
  });
  const refreshPerIp = rateLimit({ ...limiterDefaults, limit: 30 });

  router.post('/login', loginPerIp, validateBody(loginSchema), loginPerEmail, authController.login);
  router.post('/refresh', refreshPerIp, validateBody(refreshSchema), authController.refresh);
  router.get('/me', authenticate, authController.me);
  router.post(
    '/change-password',
    authenticate,
    validateBody(changePasswordSchema),
    authController.changePassword,
  );

  return router;
}
