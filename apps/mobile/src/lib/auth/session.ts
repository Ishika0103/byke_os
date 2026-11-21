import type { ApiResponse, AuthTokens } from '@byke-os/shared';
import { env } from '@/config/env';
import { tokenStore } from './token-store';

/**
 * Client-side session (Plan 01a §5, "Where the tokens are stored"):
 * - access token: in memory only, gone when the app closes
 * - refresh token: persisted (SecureStore on phones, localStorage on web)
 *
 * `refresh()` is single-flight: if several requests hit a 401 at once, only one
 * refresh call is made and they all wait for it.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const endListeners = new Set<() => void>();

async function doRefresh(): Promise<string | null> {
  const refreshToken = await tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  // Network errors propagate (we must not log the user out just because they're offline).
  const res = await fetch(`${env.apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (res.status === 401 || res.status === 403) {
    await session.end(); // expired / invalid token or disabled account
    return null;
  }
  const body = (await res.json()) as ApiResponse<AuthTokens>;
  if (!body.success) return null;

  await session.start(body.data);
  return body.data.accessToken;
}

export const session = {
  getAccessToken: () => accessToken,

  async start(tokens: AuthTokens) {
    accessToken = tokens.accessToken;
    await tokenStore.setRefreshToken(tokens.refreshToken);
  },

  /** Logout: forget both tokens on this device and notify listeners (AuthProvider). */
  async end() {
    accessToken = null;
    await tokenStore.clear();
    endListeners.forEach((listener) => listener());
  },

  /** Gets a fresh access token using the stored refresh token. Null = must log in again. */
  refresh(): Promise<string | null> {
    refreshInFlight ??= doRefresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  },

  onEnd(listener: () => void) {
    endListeners.add(listener);
    return () => {
      endListeners.delete(listener);
    };
  },
};
