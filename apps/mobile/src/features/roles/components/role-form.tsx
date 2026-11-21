import { useState, type ReactNode } from 'react';
import { createRoleSchema, updateRoleSchema, type Role } from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { TextField } from '@/components/ui/text-field';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { rolesApi } from '../api/roles.api';

const CODE_FIELDS = { NAME_TAKEN: 'name', CODE_TAKEN: 'code' };

/**
 * Add role (no `role`) or edit role, as a full screen with Save pinned at the bottom.
 * The code can only be set when creating; the API keeps it fixed afterwards.
 */
export function RoleForm({
  role,
  header,
  onSaved,
  children,
}: {
  role?: Role;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!role;
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setFormError(null);
    try {
      if (role) {
        // Send only what changed.
        const changes = {
          ...(name.trim() !== role.name && { name }),
        };
        if (Object.keys(changes).length === 0) return onSaved();
        const parsed = updateRoleSchema.safeParse(changes);
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await rolesApi.update(role.id, parsed.data);
      } else {
        const parsed = createRoleSchema.safeParse({ name, code });
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await rolesApi.create(parsed.data);
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
          title={editing ? 'Save changes' : 'Create role'}
          icon={editing ? 'check' : 'add'}
          onPress={save}
          loading={saving}
        />
      }
    >
      {formError ? <Banner message={formError} /> : null}

      <SectionLabel title="Details" />
      <Card>
        <TextField
          label="Role name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="e.g. Front Office"
          autoCapitalize="words"
          editable={!saving}
        />
        <TextField
          label="Code"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          error={errors.code}
          hint={
            editing
              ? "The code can't be changed after the role is created."
              : 'Capital letters, numbers and _. It cannot be changed later.'
          }
          placeholder="e.g. FRONT_OFFICE"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!editing && !saving}
        />
      </Card>

      {children}
    </Screen>
  );
}
