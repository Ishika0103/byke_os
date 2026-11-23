import { useCallback, useEffect, useState } from 'react';
import type { Department } from '@byke-os/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePagedList } from '@/hooks/use-paged-list';
import { errorMessage } from '@/lib/form-errors';
import { departmentsApi } from '../api/departments.api';

/** Departments list screen: search + paging. */
export function useDepartmentList(search: string) {
  const q = useDebouncedValue(search.trim());
  const fetchPage = useCallback((page: number) => departmentsApi.list({ page, limit: 30, q }), [q]);
  return usePagedList(fetchPage);
}

/** All departments for pickers (user form, task forms). */
export function useDepartmentOptions() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    departmentsApi
      .list({ limit: 100 })
      .then((data) => !cancelled && setDepartments(data.items))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { departments, error };
}

/** One department for the edit screen. */
export function useDepartment(id: string) {
  const [department, setDepartment] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    departmentsApi
      .get(id)
      .then((data) => !cancelled && setDepartment(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return {
    department,
    setDepartment,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
