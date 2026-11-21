import { useCallback, useEffect, useState } from 'react';
import type { Hotel } from '@byke-os/shared';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePagedList } from '@/hooks/use-paged-list';
import { errorMessage } from '@/lib/form-errors';
import { hotelsApi } from '../api/hotels.api';

/** Hotels list screen: search (name, code, city, state) + paging. */
export function useHotelList(search: string) {
  const q = useDebouncedValue(search.trim());
  const fetchPage = useCallback((page: number) => hotelsApi.list({ page, limit: 30, q }), [q]);
  return usePagedList(fetchPage);
}

/** One hotel for the edit screen. */
export function useHotelDetail(id: string) {
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    hotelsApi
      .get(id)
      .then((data) => !cancelled && setHotel(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return {
    hotel,
    setHotel,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
