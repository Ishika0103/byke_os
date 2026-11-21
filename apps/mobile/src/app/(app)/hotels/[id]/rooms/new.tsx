import { router, useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { RoomForm } from '@/features/rooms';

export default function NewRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoomForm
      hotelId={id}
      header={<PageHeader back title="Add room" subtitle="One room. For a range, use Add many." />}
      onSaved={() => router.back()}
    />
  );
}
