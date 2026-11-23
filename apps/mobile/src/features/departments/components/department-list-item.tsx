import type { Department } from '@byke-os/shared';

import { ListRow } from '@/components/ui/list-row';
import { StatusPill } from '@/components/ui/status-pill';

export function DepartmentListItem({
  department,
  onPress,
}: {
  department: Department;
  onPress: () => void;
}) {
  return (
    <ListRow
      icon="users"
      title={department.name}
      subtitle={department.code}
      trailing={<StatusPill active={department.isActive} />}
      chevron={false}
      onPress={onPress}
      accessibilityLabel={`${department.name}, ${department.code}, ${department.isActive ? 'active' : 'inactive'}`}
    />
  );
}
