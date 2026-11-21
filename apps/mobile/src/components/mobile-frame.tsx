import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

/** Width of the phone-sized column the app uses on web. */
export const MobileFrameWidth = 430;

/**
 * On web, shows the app as a phone-width column centred on a plain background, so people
 * use the same mobile layout on a computer as on their phone. On iOS / Android it does nothing.
 */
export function MobileFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return children;

  return (
    <View style={styles.page}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', backgroundColor: '#E8ECEC' },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: MobileFrameWidth,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
});
