import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

/**
 * Pill filter button. `onDark` = for the teal header band (see-through, white when selected).
 * `dropdown` adds a ▾ for chips that open a picker.
 */
export function Chip({
  label,
  selected,
  onPress,
  dropdown,
  onDark,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  dropdown?: boolean;
  onDark?: boolean;
}) {
  const bg = onDark
    ? selected
      ? Colors.background
      : Colors.onHeaderSurface
    : selected
      ? Colors.primary
      : Colors.background;
  const fg = onDark
    ? selected
      ? Colors.primaryPressed
      : Colors.textOnPrimary
    : selected
      ? Colors.textOnPrimary
      : Colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg },
        !onDark && !selected && { borderWidth: 1, borderColor: Colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <ThemedText style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </ThemedText>
      {dropdown ? <Icon name="chevronDown" size={16} color={fg} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  label: { fontFamily: FontFamily.semiBold, fontSize: 13, lineHeight: 20 },
});
