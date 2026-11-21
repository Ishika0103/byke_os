import { router, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Colors, FontFamily, Layout, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Teal gradient band at the top of every screen (rounded bottom corners).
 * `back` adds a round back button; `right` is a slot for actions; `children` render inside
 * the band under the title (search, filters, hero numbers…).
 */
export function PageHeader({
  title,
  subtitle,
  back,
  right,
  top,
  children,
}: {
  title?: string;
  subtitle?: string | null;
  back?: boolean;
  right?: ReactNode;
  /** Replaces the title row entirely (Home uses it for the hotel picker + avatar). */
  top?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Back = the previous screen: pops add/edit screens, and on tabs returns to the tab you
  // came from (tabs keep history). Nothing to go back to → Home.
  function goBack() {
    if (navigation.canGoBack()) navigation.goBack();
    else router.navigate('/');
  }

  return (
    <LinearGradient
      colors={[Colors.headerStart, Colors.headerEnd]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        styles.band,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: children ? Spacing.four : Spacing.four - 2,
        },
      ]}
    >
      <View style={styles.inner}>
        {top ?? (
          <View style={styles.row}>
            {back ? <HeaderButton icon="back" label="Go back" onPress={goBack} /> : null}
            <View style={styles.titles}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {title}
              </ThemedText>
              {subtitle ? (
                <ThemedText type="small" style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
            {right}
          </View>
        )}
        {children ? <View style={styles.children}>{children}</View> : null}
      </View>
    </LinearGradient>
  );
}

/** Round see-through button for the header band (back, add…). */
export function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
    >
      <Icon name={icon} size={22} color={Colors.textOnPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: {
    borderBottomLeftRadius: Layout.headerRadius,
    borderBottomRightRadius: Layout.headerRadius,
    paddingHorizontal: Spacing.three + 4,
  },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 4 },
  titles: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 34,
    color: Colors.textOnPrimary,
  },
  subtitle: { color: Colors.textOnPrimaryMuted, marginTop: -2 },
  children: { marginTop: Spacing.three + 4, gap: Spacing.two + 4 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.onHeaderSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
