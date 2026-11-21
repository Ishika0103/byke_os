import { formatLocation, type Hotel } from '@byke-os/shared';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

/** Name, "CODE · City, State" underneath, and a green Active / red Inactive pill. */
export function HotelListItem({ hotel, onPress }: { hotel: Hotel; onPress: () => void }) {
  return (
    <ListRow
      icon="hotel"
      title={hotel.name}
      subtitle={`${hotel.code} · ${formatLocation(hotel.location)}`}
      trailing={<StatusPill active={hotel.isActive} />}
      chevron={false}
      onPress={onPress}
      accessibilityLabel={`${hotel.name}, ${hotel.location.city}, ${hotel.isActive ? 'active' : 'inactive'}`}
    />
  );
}
