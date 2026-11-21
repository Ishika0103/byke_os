import * as SecureStore from 'expo-secure-store';

/**
 * Persistent storage for the REFRESH token on Android / iOS: the encrypted
 * Keychain (iOS) / Keystore (Android). The access token is never persisted
 * (see session.ts). Web uses token-store.web.ts instead.
 */
const KEY = 'byke_os.refresh_token';

export const tokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
