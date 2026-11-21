import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Round avatar with the person's initials. `muted` = grey (e.g. disabled users). */
export function Avatar({
  name,
  size = 44,
  muted = false,
  inverted = false,
}: {
  name: string;
  size?: number;
  muted?: boolean;
  /** White circle with green letters, for use on the green background. */
  inverted?: boolean;
}) {
  const bg = muted ? '#E2E6E6' : inverted ? Colors.textOnPrimary : Colors.primary;
  const fg = muted ? Colors.textSecondary : inverted ? Colors.primaryPressed : Colors.textOnPrimary;
  const fontSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.text, { color: fg, fontSize, lineHeight: Math.round(fontSize * 1.4) }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: FontFamily.semiBold, includeFontPadding: false },
});
