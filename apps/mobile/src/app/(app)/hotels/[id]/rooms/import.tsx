import { useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { useHotelDetail } from '@/features/hotels';
import { RoomImport } from '@/features/rooms';

export default function ImportRoomsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hotel } = useHotelDetail(id);
  return (
    <RoomImport
      hotelId={id}
      header={<PageHeader back title="Import rooms" subtitle={hotel?.name ?? ' '} />}
    />
  );
}
