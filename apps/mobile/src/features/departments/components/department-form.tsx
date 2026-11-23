import { useState, type ReactNode } from 'react';
import { createDepartmentSchema, updateDepartmentSchema, type Department } from '@byke-os/shared';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ReadOnly } from '@/components/ui/read-only';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { TextField } from '@/components/ui/text-field';
import { usePermission } from '@/features/auth';
import { apiErrorToForm, issuesToFieldErrors, type FieldErrors } from '@/lib/form-errors';
import { departmentsApi } from '../api/departments.api';

const CODE_FIELDS = { NAME_TAKEN: 'name' };

/**
 * Add department (no `department`) or edit one. The code is generated from the name on create
 * and never changes. `children` = extra sections on the edit screen (status, delete).
 */
export function DepartmentForm({
  department,
  header,
  onSaved,
  children,
}: {
  department?: Department;
  header: ReactNode;
  onSaved: () => void;
  children?: ReactNode;
}) {
  const editing = !!department;
  const canEdit = usePermission('edit-department');
  const locked = editing && !canEdit;
  const [name, setName] = useState(department?.name ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setFormError(null);
    try {
      if (department) {
        if (name.trim() === department.name) return onSaved();
        const parsed = updateDepartmentSchema.safeParse({ name });
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await departmentsApi.update(department.id, parsed.data);
      } else {
        const parsed = createDepartmentSchema.safeParse({ name });
        if (!parsed.success) return setErrors(issuesToFieldErrors(parsed.error.issues));
        setErrors({});
        setSaving(true);
        await departmentsApi.create(parsed.data);
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
        locked ? undefined : (
          <Button
            title={editing ? 'Save changes' : 'Create department'}
            icon={editing ? 'check' : 'add'}
            onPress={save}
            loading={saving}
          />
        )
      }
    >
      {formError ? <Banner message={formError} /> : null}
      <ReadOnly locked={locked}>
        <SectionLabel title="Details" />
        <Card>
          <TextField
            label="Department name"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="e.g. Security"
            hint={
              department
                ? `Code ${department.code} is fixed.`
                : 'A short code is made from the name. It cannot be changed later.'
            }
            autoCapitalize="words"
            editable={!saving}
          />
        </Card>
      </ReadOnly>
      {children}
    </Screen>
  );
}
