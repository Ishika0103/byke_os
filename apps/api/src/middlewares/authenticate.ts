import type { Request, RequestHandler } from 'express';
import { verifyToken } from '../modules/auth/tokens';
import { UserModel } from '../modules/users/user.model';
import type { AuthContext } from '../types/express';
import { AppError } from '../utils/app-error';

/**
 * Requires a valid access token (Plan 01a §5.5). The user is loaded on every request,
 * so deactivating or deleting a user locks them out immediately.
 * Until Part B (permissions), any authenticated user may call any protected route.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthenticated();

  const userId = verifyToken(header.slice('Bearer '.length).trim(), 'access');

  const user = await UserModel.findById(userId).select('roleId isActive').lean();
  if (!user) throw AppError.unauthenticated('Invalid or expired token');
  if (!(user as { isActive?: boolean }).isActive) throw AppError.accountDisabled();

  req.auth = { userId, roleId: String(user.roleId) };
  next();
};

/** Returns the logged-in user's context. Use only on routes behind `authenticate`. */
export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}
