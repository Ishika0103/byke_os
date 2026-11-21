import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

/** Rounded square with an icon, used at the start of list rows. */
export function IconTile({
  icon,
  size = 44,
  tint = Colors.primaryPressed,
  bg = Colors.tile,
}: {
  icon: IconName;
  size?: number;
  tint?: string;
  bg?: string;
}) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: bg },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.5)} color={tint} />
    </View>
  );
}

/**
 * One row of a CardList: leading icon/avatar, bold title, grey subtitle, optional value or
 * badge on the right and a › when tappable.
 */
export function ListRow({
  icon,
  leading,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  danger,
  muted,
  chevron = !!onPress,
  accessibilityLabel,
}: {
  icon?: IconName;
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: string | null;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  muted?: boolean;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {leading ??
        (icon ? (
          <IconTile
            icon={icon}
            tint={danger ? Colors.error : Colors.primaryPressed}
            bg={danger ? Colors.errorBackground : Colors.tile}
          />
        ) : null)}
      <View style={styles.text}>
        <ThemedText
          style={[
            styles.title,
            danger && { color: Colors.error },
            muted && { color: Colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {value ? (
        <ThemedText style={styles.value} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {trailing}
      {chevron ? <Icon name="chevronRight" size={20} color={Colors.textSecondary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.primaryLight }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three + 2,
    minHeight: 72,
    borderRadius: Radius.sm,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 24 },
  value: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.primaryPressed },
});
