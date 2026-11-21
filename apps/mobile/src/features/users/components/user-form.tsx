import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { createUserSchema, updateUserSchema, type User } from '@byke-os/shared';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useRoleOptions } from '@/features/roles';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { usersApi } from '../api/users.api';

const CODE_FIELDS = { EMAIL_TAKEN: 'email' };

/**
 * Add user (no `user`) or edit user, as a full screen with Save pinned at the bottom.
 * Passwords are set only when creating; existing users get a new one via "Reset password".
 * You can't change your own role. Status is changed with its own toggle (edit screen).
 * `children` = extra sections (edit screen actions).
 */
export function UserForm({
  user,
  isSelf = false,
  header,
  onSaved,
  children,
}: {
  user?: User;
  isSelf?: boolean;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!user;
  const { roles, error: rolesError } = useRoleOptions({ activeOnly: true });
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [roleId, setRoleId] = useState<string | null>(user?.role?.id ?? null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Active roles, plus the user's current role if it has since been deactivated.
  const roleOptions = useMemo(() => {
    const options = roles.map((r) => ({ value: r.id, label: r.name }));
    if (user?.role && !options.some((o) => o.value === user.role?.id)) {
      options.push({ value: user.role.id, label: `${user.role.name} (inactive)` });
    }
    return options;
  }, [roles, user]);

  async function save() {
    setFormError(null);
    try {
      if (user) {
        const changes = {
          ...(name.trim() !== user.name && { name }),
          ...(email.trim().toLowerCase() !== user.email && { email }),
          ...(roleId && roleId !== user.role?.id && { roleId }),
        };
        if (Object.keys(changes).length === 0) return onSaved();
        const parsed = updateUserSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await usersApi.update(user.id, parsed.data);
      } else {
        const parsed = createUserSchema.safeParse({ name, email, roleId: roleId ?? '', password });
        if (!parsed.success) {
          const fieldErrors = issuesToFieldErrors(parsed.error.issues);
          if (!roleId) fieldErrors.roleId = 'Choose a role';
          return setErrors(fieldErrors);
        }
        setErrors({});
        setSaving(true);
        await usersApi.create(parsed.data);
      }
      onSaved();
    } catch (e) {
      const { fields, message } = apiErrorToForm(e, CODE_FIELDS);
      setErrors(fields);
      setFormError(message);
      setSaving(false);
    }
  }

  return (
    <Screen
      header={header}
      footer={
        <Button
          title={editing ? 'Save changes' : 'Create user'}
          icon={editing ? 'check' : 'personAdd'}
          onPress={save}
          loading={saving}
        />
      }
    >
      {formError ? <Banner message={formError} /> : null}
      {rolesError ? <Banner message={`Couldn't load roles: ${rolesError}`} /> : null}

      <SectionLabel title="Details" />
      <Card>
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Priya Nair"
          autoCapitalize="words"
          autoComplete="off"
          editable={!saving}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="name@thebyke.com"
          autoCapitalize="none"
          autoComplete="off"
          keyboardType="email-address"
          editable={!saving}
        />
      </Card>

      <SectionLabel title="Access" />
      <Card>
        <SelectField
          label="Role"
          value={roleId}
          options={roleOptions}
          onChange={setRoleId}
          placeholder="Choose a role"
          error={errors.roleId}
          hint={isSelf ? "You can't change your own role." : undefined}
          disabled={saving || isSelf}
        />
        {editing ? null : (
          <TextField
            label="Temporary password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            hint="At least 8 characters with a letter and a number. Share it with the user."
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!saving}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                style={styles.toggle}
              >
                <ThemedText style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</ThemedText>
              </Pressable>
            }
          />
        )}
      </Card>

      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: { paddingHorizontal: Spacing.two },
  toggleText: { fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.primaryPressed },
});
