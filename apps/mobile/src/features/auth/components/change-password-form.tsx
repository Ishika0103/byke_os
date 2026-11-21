import { useState, type ReactNode } from 'react';
import { changePasswordSchema } from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { authApi } from '../api/auth.api';

/** Signed-in user changes their own password (needs the current one). */
export function ChangePasswordForm({ header, onDone }: { header: ReactNode; onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setFormError(null);
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
    setErrors({});
    setSaving(true);
    try {
      await authApi.changePassword(parsed.data);
      setDone(true);
    } catch (e) {
      const { fields, message } = apiErrorToForm(e);
      setErrors(fields);
      setFormError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        done ? (
          <Button title="Done" icon="check" onPress={onDone} />
        ) : (
          <Button title="Change password" icon="key" onPress={save} loading={saving} />
        )
      }
    >
      {done ? <Banner tone="info" message="Your password has been changed." /> : null}
      {formError ? <Banner message={formError} /> : null}
      <Card>
        <TextField
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          error={errors.currentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!saving && !done}
        />
        <TextField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={errors.newPassword}
          hint="At least 8 characters with a letter and a number."
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!saving && !done}
        />
      </Card>
    </Screen>
  );
}
