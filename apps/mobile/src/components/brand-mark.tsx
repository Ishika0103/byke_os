import { StyleSheet, Text, View } from 'react-native';

import { Brand, Colors, FontFamily, Radius } from '@/constants/theme';

const SIZES = {
  // Poppins is tall: line height must be ~1.4× the font size or iOS clips the glyphs.
  md: { badge: 32, badgeFont: 16, word: 18, gap: 10 },
  lg: { badge: 48, badgeFont: 24, word: 28, gap: 12 },
} as const;

/** Text wordmark used until official Byke OS logo assets are added. */
export function BrandMark({
  inverted = false,
  size = 'md',
}: {
  /** White version for use on the green background. */
  inverted?: boolean;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const badgeBg = inverted ? Colors.textOnPrimary : Colors.primary;
  const badgeFg = inverted ? Colors.primary : Colors.textOnPrimary;

  return (
    <View style={[styles.row, { gap: s.gap }]}>
      <View
        style={[
          styles.badge,
          { backgroundColor: badgeBg, width: s.badge, height: s.badge, borderRadius: Radius.md },
        ]}
      >
        <Text
          style={[
            styles.bold,
            { color: badgeFg, fontSize: s.badgeFont, lineHeight: Math.round(s.badgeFont * 1.4) },
          ]}
        >
          B
        </Text>
      </View>
      <Text
        style={[
          styles.bold,
          styles.word,
          {
            color: inverted ? Colors.textOnPrimary : Colors.text,
            fontSize: s.word,
            lineHeight: Math.round(s.word * 1.4),
          },
        ]}
      >
        BYKE <Text style={{ color: inverted ? Brand.primaryTint : Colors.primary }}>OS</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: FontFamily.bold, includeFontPadding: false },
  word: { letterSpacing: 1 },
});
