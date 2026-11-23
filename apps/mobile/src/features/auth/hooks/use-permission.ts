import { ALL_PERMISSIONS, hasPermission, type Permission } from '@byke-os/shared';
import { useAuth } from './use-auth';

/**
 * Plan 06: does the signed-in user's role hold this permission (`'add-hotel'`)? Hiding things with
 * this is only for convenience; the API refuses the request anyway.
 */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  return !!user && hasPermission(user.permissions, permission);
}

/** True only for Super Admin (the roles and permissions screens are theirs alone). */
export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return !!user && user.permissions.includes(ALL_PERMISSIONS);
}

/** True if the user holds at least one of these permissions. */
export function useAnyPermission(...permissions: Permission[]): boolean {
  const { user } = useAuth();
  return !!user && permissions.some((p) => hasPermission(user.permissions, p));
}
