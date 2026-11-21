import type { RoomType } from '@byke-os/shared';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

const rooms = (n: number) => (n === 1 ? '1 room' : `${n} rooms`);

/** Name, "CODE · 20 rooms · 30m clean" underneath, and the status pill. */
export function RoomTypeListItem({
  roomType,
  onPress,
}: {
  roomType: RoomType;
  onPress: () => void;
}) {
  const parts = [roomType.code, rooms(roomType.roomCount)];
  if (roomType.cleaningMinutes) parts.push(`${roomType.cleaningMinutes}m clean`);
  return (
    <ListRow
      icon="bed"
      title={roomType.name}
      subtitle={parts.join(' · ')}
      trailing={<StatusPill active={roomType.isActive} />}
      chevron={false}
      muted={!roomType.isActive}
      onPress={onPress}
      accessibilityLabel={`${roomType.name}, ${rooms(roomType.roomCount)}, ${roomType.isActive ? 'active' : 'inactive'}`}
    />
  );
}
