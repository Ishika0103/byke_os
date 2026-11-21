import type { Room } from '@byke-os/shared';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

const floorLabel = (floor: number) => (floor === 0 ? 'Ground floor' : `Floor ${floor}`);

/** "Room 101", "Deluxe Room · Floor 1 · Not sellable" underneath, and the status pill. */
export function RoomListItem({ room, onPress }: { room: Room; onPress: () => void }) {
  const parts = [room.roomType?.name ?? 'No room type'];
  if (room.floor !== null) parts.push(floorLabel(room.floor));
  if (!room.isSellable) parts.push('Not sellable');
  return (
    <ListRow
      icon="bed"
      title={`Room ${room.roomNumber}`}
      subtitle={parts.join(' · ')}
      trailing={<StatusPill active={room.isActive} />}
      chevron={false}
      muted={!room.isActive}
      onPress={onPress}
      accessibilityLabel={`Room ${room.roomNumber}, ${parts.join(', ')}, ${room.isActive ? 'active' : 'inactive'}`}
    />
  );
}
