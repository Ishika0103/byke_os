import type { Permission } from '@byke-os/shared';
import type { ReactNode } from 'react';

import { useAnyPermission } from '../hooks/use-permission';

/** Shows its children only if the user holds the permission (or any of a list). */
export function Can({
  permission,
  children,
}: {
  permission: Permission | Permission[];
  children: ReactNode;
}) {
  const allowed = useAnyPermission(...(Array.isArray(permission) ? permission : [permission]));
  return allowed ? <>{children}</> : null;
}
