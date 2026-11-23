import type { Notification } from '@byke-os/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Title, body, relative time and a dot while unread. */
export function NotificationItem({
  notification: n,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const unread = !n.readAt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.page }]}
    >
      <View style={[styles.dot, !unread && styles.dotRead]} />
      <View style={styles.text}>
        <ThemedText type={unread ? 'smallBold' : 'small'} numberOfLines={2}>
          {n.title}
        </ThemedText>
        {n.body ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {n.body}
          </ThemedText>
        ) : null}
        <ThemedText type="caption" themeColor="textSecondary">
          {timeAgo(n.createdAt)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: Colors.primary },
  dotRead: { backgroundColor: 'transparent' },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
