import { router, useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { RoomTypeForm } from '@/features/room-types';

export default function NewRoomTypeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoomTypeForm
      hotelId={id}
      header={<PageHeader back title="Add room type" subtitle="e.g. Deluxe Room, Suite" />}
      onSaved={() => router.back()}
    />
  );
}
