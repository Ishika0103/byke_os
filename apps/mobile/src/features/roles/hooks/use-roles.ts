import { useCallback, useEffect, useState } from 'react';
import type { Role, RoleSummary } from '@byke-os/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePagedList } from '@/hooks/use-paged-list';
import { errorMessage } from '@/lib/form-errors';
import { rolesApi } from '../api/roles.api';

/** Roles list screen: search + paging. */
export function useRoleList(search: string) {
  const q = useDebouncedValue(search.trim());
  const fetchPage = useCallback((page: number) => rolesApi.list({ page, limit: 30, q }), [q]);
  return usePagedList(fetchPage);
}

/**
 * Active roles (names only) for pickers: the role field and the role filter. Available to anyone
 * who can see or add users; the full roles list is Super Admin only.
 */
export function useRoleOptions() {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rolesApi
      .options()
      .then((data) => !cancelled && setRoles(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { roles, error };
}

/** One role for the edit screen. */
export function useRole(id: string) {
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    rolesApi
      .get(id)
      .then((data) => !cancelled && setRole(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return {
    role,
    setRole,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
