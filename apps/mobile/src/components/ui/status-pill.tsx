import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/theme';

const ACTIVE = { bg: '#E7F6EC', fg: Colors.success, dot: '#2EA44F' };
const INACTIVE = { bg: Colors.errorBackground, fg: Colors.error, dot: '#E5484D' };

/** "● Active" in green or "● Inactive" in red, for list rows and headers. */
export function StatusPill({ active }: { active: boolean }) {
  const look = active ? ACTIVE : INACTIVE;
  return (
    <View
      style={[styles.pill, { backgroundColor: look.bg }]}
      accessibilityLabel={active ? 'Active' : 'Inactive'}
    >
      <View style={[styles.dot, { backgroundColor: look.dot }]} />
      <Text style={[styles.text, { color: look.fg }]}>{active ? 'Active' : 'Inactive'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    height: 26,
    borderRadius: Radius.pill,
    flexShrink: 0,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: FontFamily.semiBold, fontSize: 12, lineHeight: 18 },
});
