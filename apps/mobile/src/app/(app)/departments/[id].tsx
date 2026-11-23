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
import { Can } from '@/features/auth';
import { DepartmentForm, departmentsApi, useDepartment } from '@/features/departments';
import { errorMessage } from '@/lib/form-errors';

export default function EditDepartmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { department, setDepartment, error, retry } = useDepartment(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!department) {
    return (
      <Screen header={<PageHeader back title="Edit department" />}>
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
      await departmentsApi.remove(id);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      // e.g. DEPARTMENT_IN_USE
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <DepartmentForm
      key={department.id}
      department={department}
      header={<PageHeader back title={department.name} subtitle={department.code} />}
      onSaved={() => router.back()}
    >
      <Can permission="edit-department">
        <SectionLabel title="Status" />
        <StatusToggle
          active={department.isActive}
          onChange={async (isActive) =>
            setDepartment(await departmentsApi.update(department.id, { isActive }))
          }
          description={
            department.isActive
              ? 'Can be given to users and tasks'
              : "Can't be chosen for new users or tasks while inactive"
          }
          activate={{
            title: `Make ${department.name} active?`,
            message: 'It can be chosen again.',
            confirmLabel: 'Make active',
          }}
          deactivate={{
            title: `Make ${department.name} inactive?`,
            message: "It won't be offered when adding users or tasks.",
            confirmLabel: 'Make inactive',
          }}
        />
      </Can>

      <Can permission="delete-department">
        <Button
          title="Delete department"
          icon="delete"
          variant="danger"
          onPress={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        />
      </Can>
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${department.name}?`}
        message="Only departments that no user belongs to can be deleted."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </DepartmentForm>
  );
}
