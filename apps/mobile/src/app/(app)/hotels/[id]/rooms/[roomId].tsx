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
import { RoomForm, roomsApi, useRoomDetail } from '@/features/rooms';
import { errorMessage } from '@/lib/form-errors';

export default function EditRoomScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const { room, setRoom, error, retry } = useRoomDetail(id, roomId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!room) {
    return (
      <Screen header={<PageHeader back title="Edit room" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={3} />
        )}
      </Screen>
    );
  }

  const title = `Room ${room.roomNumber}`;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await roomsApi.remove(id, roomId);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <RoomForm
      key={room.id}
      hotelId={id}
      room={room}
      header={<PageHeader back title={title} subtitle={room.roomType?.name} />}
      onSaved={() => router.back()}
    >
      <SectionLabel title="Status" />
      <StatusToggle
        active={room.isActive}
        onChange={async (isActive) => setRoom(await roomsApi.update(id, roomId, { isActive }))}
        description={room.isActive ? 'In use at the hotel' : 'Not in use for now'}
        activate={{
          title: `Make ${title} active?`,
          message: 'It will be in use at the hotel again.',
          confirmLabel: 'Make active',
        }}
        deactivate={{
          title: `Make ${title} inactive?`,
          message: 'Use this when a room is closed for a long time. Its data stays.',
          confirmLabel: 'Make inactive',
        }}
      />

      <Button
        title="Delete room"
        icon="delete"
        variant="danger"
        onPress={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${title}?`}
        message="It will be removed from this hotel. To stop using it for now instead, make it inactive."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </RoomForm>
  );
}
