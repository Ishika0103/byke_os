import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthTokens } from '@byke-os/shared';
import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';

/**
 * Stateless JWTs (Plan 01a §5.1). Access and refresh tokens use different secrets and a
 * `type` claim, so one can never be used in place of the other. Tokens carry only the
 * user id — no personal data (JWTs are readable by anyone).
 */
type TokenType = 'access' | 'refresh';

const ISSUER = 'byke-os-api';
const AUDIENCE = 'byke-os-app';

const config: Record<TokenType, { secret: string; ttl: string }> = {
  access: { secret: env.JWT_ACCESS_SECRET, ttl: env.JWT_ACCESS_TTL },
  refresh: { secret: env.JWT_REFRESH_SECRET, ttl: env.JWT_REFRESH_TTL },
};

function sign(userId: string, type: TokenType): string {
  const { secret, ttl } = config[type];
  return jwt.sign({ type }, secret, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: ttl as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function issueTokens(userId: string): AuthTokens {
  return { accessToken: sign(userId, 'access'), refreshToken: sign(userId, 'refresh') };
}

/** Verifies signature, expiry, issuer, audience and type. Returns the user id. */
export function verifyToken(token: string, type: TokenType): string {
  try {
    const payload = jwt.verify(token, config[type].secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload === 'string' || payload.type !== type || !payload.sub) {
      throw new Error('Wrong token type');
    }
    return payload.sub;
  } catch {
    throw AppError.unauthenticated('Invalid or expired token');
  }
}
