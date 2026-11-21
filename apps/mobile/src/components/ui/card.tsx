import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Layout, Shadow, Spacing } from '@/constants/theme';

/** Flat white card (radius 20, soft shadow). With `onPress` it eases down slightly while pressed. */
export function Card({
  children,
  style,
  padded = true,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
}) {
  const body = <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      {body}
    </Pressable>
  );
}

/** Rows inside one card, separated by a hairline that starts after the row icon. */
export function CardList({ children, inset = 76 }: { children: ReactNode; inset?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <Card padded={false}>
      {items.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={[styles.divider, { marginLeft: inset }]} /> : null}
          {child}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: Layout.cardRadius,
    overflow: 'hidden',
    ...Shadow.card,
  },
  padded: { padding: Spacing.three + 4, gap: Spacing.three },
  divider: { height: 1, backgroundColor: Colors.border, marginRight: Spacing.three + 2 },
});
