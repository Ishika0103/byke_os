import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Can } from '@/features/auth';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { StatusToggle } from '@/components/ui/status-toggle';
import { RoomTypeForm, roomTypesApi, useRoomTypeDetail } from '@/features/room-types';
import { errorMessage } from '@/lib/form-errors';

export default function EditRoomTypeScreen() {
  const { id, typeId } = useLocalSearchParams<{ id: string; typeId: string }>();
  const { roomType, setRoomType, error, retry } = useRoomTypeDetail(id, typeId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!roomType) {
    return (
      <Screen header={<PageHeader back title="Edit room type" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={3} />
        )}
      </Screen>
    );
  }

  const rooms = roomType.roomCount === 1 ? '1 room' : `${roomType.roomCount} rooms`;
  const hasRooms = roomType.roomCount > 0;

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await roomTypesApi.remove(id, typeId);
      setDeleteOpen(false);
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <RoomTypeForm
      key={roomType.id}
      hotelId={id}
      roomType={roomType}
      header={<PageHeader back title={roomType.name} subtitle={`${roomType.code} · ${rooms}`} />}
      onSaved={() => router.back()}
    >
      <Can permission="edit-room-type">
        <SectionLabel title="Status" />
        <StatusToggle
          active={roomType.isActive}
          onChange={async (isActive) =>
            setRoomType(await roomTypesApi.update(id, typeId, { isActive }))
          }
          description={
            roomType.isActive ? 'Rooms can be added to it' : "Rooms can't be added to it for now"
          }
          disabledReason={
            roomType.isActive && hasRooms
              ? `It has ${rooms}. Move or delete them before making it inactive.`
              : undefined
          }
          activate={{
            title: `Make ${roomType.name} active?`,
            message: 'Rooms can be added to it again.',
            confirmLabel: 'Make active',
          }}
          deactivate={{
            title: `Make ${roomType.name} inactive?`,
            message: "New rooms can't be added to it until you make it active again.",
            confirmLabel: 'Make inactive',
          }}
        />
      </Can>

      <Can permission="delete-room-type">
        <Button
          title="Delete room type"
          icon="delete"
          variant="danger"
          disabled={hasRooms}
          onPress={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        />
      </Can>
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${roomType.name}?`}
        message="It will be removed from this hotel."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </RoomTypeForm>
  );
}
