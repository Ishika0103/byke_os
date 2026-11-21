import { useCallback, useEffect, useState } from 'react';
import type { User } from '@byke-os/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePagedList } from '@/hooks/use-paged-list';
import { errorMessage } from '@/lib/form-errors';
import { usersApi } from '../api/users.api';

export type UserStatusFilter = 'all' | 'active';

/** Users list screen: search, role and status filters, paging. */
export function useUserList(filters: {
  search: string;
  roleId: string | null;
  status: UserStatusFilter;
}) {
  const q = useDebouncedValue(filters.search.trim());
  const { roleId, status } = filters;
  const fetchPage = useCallback(
    (page: number) =>
      usersApi.list({
        page,
        limit: 20,
        q,
        roleId: roleId ?? undefined,
        isActive: status === 'active' ? true : undefined,
      }),
    [q, roleId, status],
  );
  return usePagedList(fetchPage);
}

/** One user for the edit screen. */
export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .get(id)
      .then((data) => !cancelled && setUser(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return {
    user,
    setUser,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
