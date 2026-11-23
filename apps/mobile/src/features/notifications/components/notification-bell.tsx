import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Colors, FontFamily } from '@/constants/theme';
import { useUnreadCount } from '../hooks/use-notifications';

/** Bell button for the Home header with an unread-count badge. */
export function NotificationBell() {
  const count = useUnreadCount();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      onPress={() => router.push('/notifications')}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
    >
      <Icon name="bell" size={22} color={Colors.textOnPrimary} />
      {count > 0 ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.onHeaderSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: 11, lineHeight: 14, color: '#FFFFFF' },
});
