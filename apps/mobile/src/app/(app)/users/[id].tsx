import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardList } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { StatusToggle } from '@/components/ui/status-toggle';
import { useAuth } from '@/features/auth';
import { ResetPasswordDialog, UserForm, usersApi, useUser } from '@/features/users';
import { errorMessage } from '@/lib/form-errors';

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const { user, setUser, error, retry } = useUser(id);

  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) {
    return (
      <Screen header={<PageHeader back title="Edit user" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={3} />
        )}
      </Screen>
    );
  }

  const isSelf = user.id === me?.id;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.remove(id);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <UserForm
      key={user.id}
      user={user}
      isSelf={isSelf}
      header={<PageHeader back title={user.name} subtitle={user.email} />}
      onSaved={() => router.back()}
    >
      <SectionLabel title="Status" />
      <StatusToggle
        active={user.isActive}
        onChange={async (isActive) => setUser(await usersApi.update(user.id, { isActive }))}
        description={
          user.isActive ? 'Can sign in to Byke OS' : "Can't sign in until made active again"
        }
        disabledReason={isSelf ? "You can't make yourself inactive" : undefined}
        activate={{
          title: `Make ${user.name} active?`,
          message: 'They will be able to sign in to Byke OS again.',
          confirmLabel: 'Make active',
        }}
        deactivate={{
          title: `Make ${user.name} inactive?`,
          message:
            "They won't be able to sign in until you make them active again. Their records stay.",
          confirmLabel: 'Make inactive',
        }}
      />

      <SectionLabel title="Security" />
      <CardList>
        <ListRow
          icon="lock"
          title="Reset password"
          subtitle="Set a new password for this person"
          onPress={() => setResetOpen(true)}
        />
      </CardList>

      {isSelf ? null : (
        <Button
          title="Delete user"
          icon="delete"
          variant="danger"
          onPress={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        />
      )}

      <ResetPasswordDialog user={user} visible={resetOpen} onClose={() => setResetOpen(false)} />
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${user.name}?`}
        message="They will no longer be able to sign in to Byke OS. Their past records stay. To pause access instead, make them inactive."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </UserForm>
  );
}
