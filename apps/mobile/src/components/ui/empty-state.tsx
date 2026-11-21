import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { type IconName } from '@/components/ui/icon';
import { IconTile } from '@/components/ui/list-row';
import { Colors, FontFamily, Spacing } from '@/constants/theme';

/**
 * Icon, title and one line, e.g. "No users match". Also used for load errors (with Retry).
 * `action` adds a button, e.g. "Add hotel".
 */
export function EmptyState({
  icon,
  title,
  body,
  error,
  onRetry,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string | null;
  error?: boolean;
  onRetry?: () => void;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={styles.card}>
      <IconTile
        icon={icon}
        size={56}
        tint={error ? Colors.error : Colors.primaryPressed}
        bg={error ? Colors.errorBackground : Colors.tile}
      />
      <ThemedText style={styles.title}>{title}</ThemedText>
      {body ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
          {body}
        </ThemedText>
      ) : null}
      {action ? (
        <Button
          title={action.label}
          icon="add"
          compact
          onPress={action.onPress}
          style={styles.retry}
        />
      ) : null}
      {onRetry ? (
        <Button title="Try again" variant="soft" compact onPress={onRetry} style={styles.retry} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: Spacing.five - 4, gap: Spacing.one },
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    lineHeight: 26,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  body: { textAlign: 'center' },
  retry: { marginTop: Spacing.three, alignSelf: 'stretch' },
});
