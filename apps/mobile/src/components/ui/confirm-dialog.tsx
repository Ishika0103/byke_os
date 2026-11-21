import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spacing } from '@/constants/theme';

/** "Are you sure?" alert. `tone` danger (default) = red confirm button, primary = teal. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  error,
  tone = 'danger',
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Dialog visible={visible} title={title} onClose={onCancel}>
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
      {error ? <Banner message={error} /> : null}
      <View style={styles.actions}>
        <Button title="Cancel" variant="soft" compact onPress={onCancel} style={styles.action} />
        <Button
          title={confirmLabel}
          variant={tone}
          compact
          onPress={onConfirm}
          loading={busy}
          style={styles.action}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two + 4, marginTop: Spacing.two },
  action: { flex: 1, paddingHorizontal: Spacing.two },
});
