import type { Request, RequestHandler } from 'express';
import { ALL_PERMISSIONS } from '@byke-os/shared';
import type { Types } from 'mongoose';
import { verifyToken } from '../modules/auth/tokens';
import { RoleModel } from '../modules/roles/role.model';
import { UserModel } from '../modules/users/user.model';
import type { AuthContext } from '../types/express';
import { AppError } from '../utils/app-error';

/**
 * Requires a valid access token (Plan 01a §5.5). The user is loaded on every request,
 * so deactivating or deleting a user, or changing their hotels, applies immediately.
 * Permissions are checked per route with `authorize(...)` (Plan 06).
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthenticated();

  const userId = verifyToken(header.slice('Bearer '.length).trim(), 'access');

  const user = await UserModel.findById(userId)
    .select('roleId isActive hotelIds')
    .lean<{ roleId: Types.ObjectId; isActive: boolean; hotelIds?: Types.ObjectId[] }>();
  if (!user) throw AppError.unauthenticated('Invalid or expired token');
  if (!user.isActive) throw AppError.accountDisabled();

  // Plan 06: permissions come from the role, read on every request so changes apply at once.
  const role = await RoleModel.findById(user.roleId)
    .select('permissions')
    .lean<{ permissions?: string[] }>();
  const permissions = role?.permissions ?? [];
  // Plan 05: Super Admin ('*') sees every hotel; everyone else only the hotels they are mapped to.
  const hotelIds = permissions.includes(ALL_PERMISSIONS)
    ? null
    : (user.hotelIds ?? []).map((id) => String(id));

  req.auth = { userId, roleId: String(user.roleId), hotelIds, permissions };
  next();
};

/** Returns the logged-in user's context. Use only on routes behind `authenticate`. */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}

/** True if the logged-in user may see this hotel. */
export function canSeeHotel(req: Request, hotelId: string): boolean {
  const { hotelIds } = requireAuth(req);
  return hotelIds === null || hotelIds.includes(hotelId);
}
