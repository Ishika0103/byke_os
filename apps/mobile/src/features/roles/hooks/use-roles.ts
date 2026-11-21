import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@byke-os/shared';

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
 * All roles in one go, for pickers (role field, role filter). The API caps a page at
 * 100; Byke has a handful of roles, so one page is enough.
 */
export function useRoleOptions({ activeOnly = false } = {}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rolesApi
      .list({ limit: 100, ...(activeOnly && { isActive: true }) })
      .then((data) => !cancelled && setRoles(data.items))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [activeOnly]);

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
