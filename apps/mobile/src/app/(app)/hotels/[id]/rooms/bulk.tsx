import { router, useLocalSearchParams } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { BulkRoomsForm } from '@/features/rooms';

export default function BulkRoomsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <BulkRoomsForm
      hotelId={id}
      header={
        <PageHeader back title="Add many rooms" subtitle="A range of numbers, e.g. 101 to 120" />
      }
      onSaved={() => router.back()}
    />
  );
}
