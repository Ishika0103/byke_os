import { Colors } from '@/constants/theme';

/** Byke colours. Kept as a hook so screens don't change if a dark theme is added later. */
export function useTheme() {
  return Colors;
}
