import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { resetPasswordSchema, type User } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { apiErrorToForm, issuesToFieldErrors } from '@/lib/form-errors';
import { usersApi } from '../api/users.api';

/** Admin sets a new password for a user (they share it with the user). */
export function ResetPasswordDialog({
  user,
  visible,
  onClose,
}: {
  user: User;
  visible: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setPassword('');
    setError(undefined);
    setFormError(null);
    setDone(false);
    onClose();
  }

  async function save() {
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ newPassword: password });
    if (!parsed.success) return setError(issuesToFieldErrors(parsed.error.issues).newPassword);
    setError(undefined);
    setSaving(true);
    try {
      await usersApi.resetPassword(user.id, parsed.data);
      setDone(true);
    } catch (e) {
      const { fields, message } = apiErrorToForm(e);
      setError(fields.newPassword);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog visible={visible} title="Reset password" onClose={close}>
      {done ? (
        <>
          <ThemedText>
            Password for {user.name} has been changed. Share the new password with them.
          </ThemedText>
          <Button title="Done" compact onPress={close} />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Set a new password for {user.name}. Their old password stops working.
          </ThemedText>
          {formError ? <Banner message={formError} /> : null}
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            error={error}
            placeholder="At least 8 characters"
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!saving}
          />
          <View style={styles.actions}>
            <Button title="Cancel" variant="soft" compact onPress={close} style={styles.action} />
            <Button title="Reset" compact onPress={save} loading={saving} style={styles.action} />
          </View>
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  action: { flex: 1, paddingHorizontal: Spacing.two },
});
