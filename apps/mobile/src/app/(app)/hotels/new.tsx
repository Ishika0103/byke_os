import { router } from 'expo-router';

import { PageHeader } from '@/components/ui/page-header';
import { HotelForm, useHotel } from '@/features/hotels';

export default function NewHotelScreen() {
  const { reloadHotels } = useHotel();
  return (
    <HotelForm
      header={<PageHeader back title="Add hotel" subtitle="A Byke property on Byke OS" />}
      onSaved={() => {
        reloadHotels();
        router.back();
      }}
    />
  );
}
