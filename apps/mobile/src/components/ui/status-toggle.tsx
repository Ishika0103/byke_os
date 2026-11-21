import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusPill } from '@/components/ui/status-pill';
import { Colors, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/form-errors';

type Copy = { title: string; message: string; confirmLabel: string };

/**
 * Active / Inactive switch. With `activate` / `deactivate` text it saves straight away, but only
 * after a confirmation popup: `onChange` does the API call, and if it fails the error shows in the
 * popup and nothing changes. Without them (e.g. on an add form) it just flips `onChange`.
 */
export function StatusToggle({
  active,
  onChange,
  activate,
  deactivate,
  description,
  disabledReason,
}: {
  active: boolean;
  onChange: (next: boolean) => void | Promise<void>;
  /** Popup text for turning it on / off. Leave out to switch without asking. */
  activate?: Copy;
  deactivate?: Copy;
  /** What the status means, shown under the label. */
  description: string;
  /** When set, the switch is locked and this explains why (e.g. "You can't deactivate yourself"). */
  disabledReason?: string;
}) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = pending ? activate : deactivate;

  async function confirm() {
    if (pending === null) return;
    setBusy(true);
    setError(null);
    try {
      await onChange(pending);
      setPending(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={[styles.row, disabledReason ? styles.locked : null]}>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <StatusPill active={active} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {disabledReason ?? description}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel={active ? 'Make inactive' : 'Make active'}
          value={active}
          onValueChange={(next) => {
            if (!activate || !deactivate) return void onChange(next);
            setError(null);
            setPending(next);
          }}
          disabled={!!disabledReason}
          trackColor={{ false: '#CBD5D4', true: Colors.primary }}
          thumbColor="#FFFFFF"
          {...{ activeTrackColor: Colors.primary, activeThumbColor: '#FFFFFF' }}
        />
      </View>

      {copy ? (
        <ConfirmDialog
          visible={pending !== null}
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.confirmLabel}
          tone={pending ? 'primary' : 'danger'}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          busy={busy}
          error={error}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  locked: { opacity: 0.6 },
  text: { flex: 1, gap: 6 },
  titleRow: { flexDirection: 'row' },
});
