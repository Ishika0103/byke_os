import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

/** Quiet section title above a card, with an optional "View all ›" style action. */
export function SectionLabel({
  title,
  note,
  action,
  onAction,
}: {
  title: string;
  /** Small grey text on the right when there's no action (e.g. "Demo numbers"). */
  note?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.action}>
          <ThemedText style={styles.actionText}>{action}</ThemedText>
          <Icon name="chevronRight" size={16} color={Colors.primaryPressed} />
        </Pressable>
      ) : note ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    marginBottom: -Spacing.one,
    marginHorizontal: Spacing.one,
  },
  title: { fontFamily: FontFamily.semiBold, fontSize: 17, lineHeight: 26 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.primaryPressed },
});
