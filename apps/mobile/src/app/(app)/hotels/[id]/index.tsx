import { formatLocation } from '@byke-os/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardList } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Screen } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/section-label';
import { SkeletonList } from '@/components/ui/skeleton';
import { StatusToggle } from '@/components/ui/status-toggle';
import { HotelForm, hotelsApi, useHotel, useHotelDetail } from '@/features/hotels';
import { useRoomCounts } from '@/features/rooms';
import { errorMessage } from '@/lib/form-errors';

export default function EditHotelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hotel, setHotel, error, retry } = useHotelDetail(id);
  const { reloadHotels } = useHotel();
  const counts = useRoomCounts(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!hotel) {
    return (
      <Screen header={<PageHeader back title="Edit hotel" />}>
        {error ? (
          <EmptyState icon="warning" title="Couldn't load" body={error} error onRetry={retry} />
        ) : (
          <SkeletonList rows={3} />
        )}
      </Screen>
    );
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await hotelsApi.remove(id);
      setDeleteOpen(false);
      reloadHotels();
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
      setDeleting(false);
    }
  }

  return (
    <HotelForm
      key={hotel.id}
      hotel={hotel}
      header={
        <PageHeader
          back
          title={hotel.name}
          subtitle={`${hotel.code} · ${formatLocation(hotel.location)}`}
        />
      }
      onSaved={() => {
        reloadHotels();
        router.back();
      }}
    >
      <SectionLabel title="Rooms" />
      <CardList>
        <ListRow
          icon="bed"
          title="Room types"
          subtitle="Deluxe, Suite, cleaning time"
          value={counts ? String(counts.roomTypes) : undefined}
          onPress={() => router.push({ pathname: '/hotels/[id]/room-types', params: { id } })}
        />
        <ListRow
          icon="hotel"
          title="Rooms"
          subtitle="Numbers, floors, sellable"
          value={counts ? String(counts.rooms) : undefined}
          onPress={() => router.push({ pathname: '/hotels/[id]/rooms', params: { id } })}
        />
      </CardList>

      <SectionLabel title="Status" />
      <StatusToggle
        active={hotel.isActive}
        onChange={async (isActive) => {
          setHotel(await hotelsApi.update(hotel.id, { isActive }));
          reloadHotels();
        }}
        description={hotel.isActive ? 'Shown in the hotel picker' : 'Hidden from the hotel picker'}
        activate={{
          title: `Make ${hotel.name} active?`,
          message: 'It will show in the hotel picker again.',
          confirmLabel: 'Make active',
        }}
        deactivate={{
          title: `Make ${hotel.name} inactive?`,
          message:
            "It won't show in the hotel picker until you make it active again. Its data stays.",
          confirmLabel: 'Make inactive',
        }}
      />

      <Button
        title="Delete hotel"
        icon="delete"
        variant="danger"
        onPress={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      />
      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${hotel.name}?`}
        message="It will be removed from Byke OS. To hide it for now instead, make it inactive. A hotel with room types or rooms can't be deleted."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
        busy={deleting}
        error={deleteError}
      />
    </HotelForm>
  );
}
