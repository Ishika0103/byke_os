import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:4000/api/v1';

/**
 * EXPO_PUBLIC_* variables are inlined at build time, so never put secrets here.
 *
 * On a phone or emulator, "localhost" is the device itself, not the computer running the
 * API. In development we swap it for the address the device already uses to reach the
 * Expo dev server (e.g. 192.168.0.104), so the same .env works on web, emulators and real
 * phones on the same Wi-Fi.
 */
function resolveApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
  if (Platform.OS === 'web' || !url.includes('localhost')) return url;

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return url.replace('localhost', devHost);
  // No dev server info: the Android emulator reaches the host machine on 10.0.2.2.
  return Platform.OS === 'android' ? url.replace('localhost', '10.0.2.2') : url;
}

export const env = {
  apiUrl: resolveApiUrl(),
} as const;
