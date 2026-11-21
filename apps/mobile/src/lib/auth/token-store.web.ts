/**
 * Web storage for the REFRESH token. expo-secure-store has no web support, so the
 * pilot uses localStorage. ⚠️ Readable by any script on the page (XSS risk);
 * Plan 01 Phase 6 moves it to an httpOnly cookie set by the API.
 */
const KEY = 'byke_os.refresh_token';

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // storage blocked (private mode, etc.)
  }
}

export const tokenStore = {
  getRefreshToken: async () => storage()?.getItem(KEY) ?? null,
  setRefreshToken: async (token: string) => storage()?.setItem(KEY, token),
  clear: async () => storage()?.removeItem(KEY),
};
