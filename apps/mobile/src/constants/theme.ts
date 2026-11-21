/**
 * Byke OS design tokens.
 * Brand colours and typography follow the Byke website theme
 * (byke-frontend → src/_components/theme/theme-options.ts):
 *   primary #06B2A6 (teal green), light tints #EFFFFE / #F0FFFE, text #2A2626, font Poppins, radius 12.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Brand = {
  primary: '#06B2A6',
  primaryDark: '#04877E',
  primaryLight: '#EFFFFE',
  primaryTint: '#92FFF7',
  ink: '#2A2626',
} as const;

/**
 * Light theme only: the Byke brand is light (as on the website), so the app ignores the
 * phone's dark mode (app.json userInterfaceStyle "light"). Add a dark palette here if needed later.
 */
export const Colors = {
  text: Brand.ink,
  textSecondary: '#6B6767',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryMuted: '#E6FFFC',
  background: '#FFFFFF',
  backgroundElement: '#F0FFFE',
  backgroundSelected: '#D2F5F2',
  border: '#DDE7E6',
  primary: Brand.primary,
  primaryPressed: Brand.primaryDark,
  primaryLight: Brand.primaryLight,
  error: '#D32F2F',
  errorBackground: '#FDECEC',
  success: '#2E7D32',
  /** Screen background under white cards (smartcal "Mist" equivalent). */
  page: '#F2F8F7',
  /** Soft teal square behind row icons. */
  tile: '#E1F5F3',
  /** Header band gradient, top-left to bottom-right. */
  headerStart: '#09C2B5',
  headerEnd: Brand.primaryDark,
  /** White-on-teal surfaces inside the header band. */
  onHeaderSurface: 'rgba(255,255,255,0.18)',
} as const;

export type ThemeColor = keyof typeof Colors;

/**
 * Poppins weights, loaded in app/_layout.tsx via @expo-google-fonts/poppins.
 * Use fontFamily (not fontWeight) to pick a weight: Android can't synthesise custom font weights.
 */
export const FontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: { sans: FontFamily.regular, mono: 'ui-monospace' },
  default: { sans: FontFamily.regular, mono: 'monospace' },
  web: { sans: FontFamily.regular, mono: 'var(--font-mono)' },
});

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

export const Layout = {
  tabBarHeight: 64,
  fabSize: 60,
  controlHeight: 52,
  buttonHeight: 56,
  cardRadius: 20,
  headerRadius: 32,
} as const;

/** Soft shadows that also look right on Android (low elevation, tinted). */
export const Shadow = {
  card: {
    shadowColor: '#0B3B37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0B3B37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;
