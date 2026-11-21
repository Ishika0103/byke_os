import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { StatusToggle } from '@/components/ui/status-toggle';
import { RoleForm, rolesApi, useRole } from '@/features/roles';
import { errorMessage } from '@/lib/form-errors';

export default function EditRoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, setRole, error, retry } = useRole(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!role) {
    return (
      <Screen header={<PageHeader back title="Edit role" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={2} />
        )}
      </Screen>
    );
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await rolesApi.remove(id);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      // e.g. ROLE_IN_USE: "Role is assigned to users; reassign them first"
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <RoleForm
      key={role.id}
      role={role}
      header={<PageHeader back title={role.name} subtitle={role.code} />}
      onSaved={() => router.back()}
    >
      <SectionLabel title="Status" />
      <StatusToggle
        active={role.isActive}
        onChange={async (isActive) => setRole(await rolesApi.update(role.id, { isActive }))}
        description={
          role.isActive ? 'Can be given to users' : "Can't be given to users while inactive"
        }
        activate={{
          title: `Make ${role.name} active?`,
          message: 'It can be given to users again.',
          confirmLabel: 'Make active',
        }}
        deactivate={{
          title: `Make ${role.name} inactive?`,
          message:
            "It won't be offered when adding or editing users. Only roles that no user has can be made inactive.",
          confirmLabel: 'Make inactive',
        }}
      />

      <Button
        title="Delete role"
        icon="delete"
        variant="danger"
        onPress={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${role.name}?`}
        message="Only roles that no user has can be deleted. Move people to another role first."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </RoleForm>
  );
}
