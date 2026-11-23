import type { RequestHandler } from 'express';
import { ALL_PERMISSIONS, hasPermission, type Permission } from '@byke-os/shared';
import { AppError } from '../utils/app-error';
import { requireAuth } from './authenticate';

/**
 * Plan 06: allows the request if the user's role holds any of the named permissions
 * (Super Admin's `*` holds all). Runs after `authenticate`.
 */
export const authorize =
  (...allowed: Permission[]): RequestHandler =>
  (req, _res, next) => {
    const { permissions } = requireAuth(req);
    if (allowed.some((p) => hasPermission(permissions, p))) return next();
    throw AppError.forbidden(`You don't have permission: ${allowed.join(' or ')}`);
  };

/** Roles and permissions can only be managed by Super Admin (not a grantable permission). */
export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (requireAuth(req).permissions.includes(ALL_PERMISSIONS)) return next();
  throw AppError.forbidden('Only Super Admin can do this');
};
