import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Colors, FontFamily, Layout, Shadow } from '@/constants/theme';
import { usePermission } from '@/features/auth';
import type { Permission } from '@byke-os/shared';

type Tab = { route: string; label: string; icon: IconName; permission?: Permission };

const LEFT: Tab[] = [
  { route: 'index', label: 'Home', icon: 'home' },
  { route: 'users', label: 'Users', icon: 'users', permission: 'view-user' },
];
const RIGHT: Tab[] = [
  { route: 'tasks', label: 'Tasks', icon: 'tasks', permission: 'view-task' },
  { route: 'profile', label: 'Settings', icon: 'settings' },
];

/** Space a tab screen must leave at the bottom so its content isn't hidden by the bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return Layout.tabBarHeight + insets.bottom + 28;
}

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/**
 * Footer: Home · Users · [+] · Tasks · Settings. The round + floats half above the bar and
 * opens Add task (the only quick add now).
 */
export function AppTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const canUsers = usePermission('view-user');
  const canTasks = usePermission('view-task');
  const canAddTask = usePermission('add-task');
  const allowed = (tab: Tab) =>
    tab.route === 'users' ? canUsers : tab.route === 'tasks' ? canTasks : true;

  const renderTab = (tab: Tab) => (
    <TabButton
      key={tab.route}
      tab={tab}
      active={current === tab.route}
      onPress={() => {
        tap();
        const key = state.routes.find((r) => r.name === tab.route)?.key;
        if (key) navigateToTab(key);
      }}
    />
  );

  return (
    <>
      <View style={[styles.bar, { height: Layout.tabBarHeight + insets.bottom }]}>
        {LEFT.filter(allowed).map(renderTab)}
        <View style={styles.fabSpace} />
        {RIGHT.filter(allowed).map(renderTab)}
      </View>

      {canAddTask ? (
        <View
          style={[
            styles.fabWrap,
            { bottom: insets.bottom + Layout.tabBarHeight - Layout.fabSize / 2 - 8 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add task"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              router.push('/tasks/new');
            }}
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <Icon name="add" size={30} color={Colors.textOnPrimary} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

function TabButton({ tab, active, onPress }: { tab: Tab; active: boolean; onPress: () => void }) {
  const tint = active ? Colors.primary : '#8C9493';
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(active ? 1 : 0.92, { duration: 200 }) }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon name={tab.icon} size={24} color={tint} />
      </Animated.View>
      <ThemedText
        style={[styles.label, { color: tint }, active && { fontFamily: FontFamily.semiBold }]}
      >
        {tab.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 9,
    paddingHorizontal: 8,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 11, lineHeight: 16 },
  fabSpace: { width: Layout.fabSize + 12 },
  fabWrap: { position: 'absolute', alignSelf: 'center' },
  fab: {
    width: Layout.fabSize,
    height: Layout.fabSize,
    borderRadius: Layout.fabSize / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.background,
    ...Shadow.raised,
  },
});
