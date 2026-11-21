import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/theme';

const TONES = {
  primary: { bg: '#E3F8F6', fg: Colors.primaryPressed },
  warning: { bg: '#FFF1E0', fg: '#8A3A00' },
  neutral: { bg: '#EEF2F2', fg: Colors.textSecondary },
} as const;

/** Small rounded label, e.g. a role name or "Disabled". */
export function Badge({ label, tone = 'primary' }: { label: string; tone?: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 2, flexShrink: 0 },
  text: { fontFamily: FontFamily.semiBold, fontSize: 11, lineHeight: 18 },
});
