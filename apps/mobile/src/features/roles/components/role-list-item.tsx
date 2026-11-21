import type { Role } from '@byke-os/shared';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

export function RoleListItem({ role, onPress }: { role: Role; onPress: () => void }) {
  return (
    <ListRow
      icon="roles"
      title={role.name}
      subtitle={role.code}
      trailing={<StatusPill active={role.isActive} />}
      chevron={false}
      onPress={onPress}
      accessibilityLabel={`${role.name}, ${role.code}, ${role.isActive ? 'active' : 'inactive'}`}
    />
  );
}
