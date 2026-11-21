import type { User } from '@byke-os/shared';

import { Avatar } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

/** Name (and "you"), "Role · email" underneath, and a green Active / red Inactive pill. */
export function UserListItem({
  user,
  isSelf,
  onPress,
}: {
  user: User;
  isSelf: boolean;
  onPress: () => void;
}) {
  return (
    <ListRow
      leading={<Avatar name={user.name} muted={!user.isActive} />}
      title={isSelf ? `${user.name} (you)` : user.name}
      subtitle={`${user.role?.name ?? 'No role'} · ${user.email}`}
      trailing={<StatusPill active={user.isActive} />}
      chevron={false}
      onPress={onPress}
      accessibilityLabel={`${user.name}, ${user.role?.name ?? 'no role'}, ${user.isActive ? 'active' : 'inactive'}`}
    />
  );
}
