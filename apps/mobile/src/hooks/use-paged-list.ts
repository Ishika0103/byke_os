import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import type { Paginated } from '@byke-os/shared';

import { errorMessage } from '@/lib/form-errors';

/**
 * Paged list for list screens: first page on focus (so it refreshes after you add or
 * edit something and come back), `loadMore` for the next page, pull-to-refresh.
 * `fetchPage` must change whenever its filters change (wrap it in useCallback).
 */
export function usePagedList<T>(fetchPage: (page: number) => Promise<Paginated<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ignore responses from an older request (e.g. the user kept typing in search).
  const requestId = useRef(0);

  const loadFirst = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;
      if (mode === 'refresh') setRefreshing(true);
      setError(null);
      try {
        const data = await fetchPage(1);
        if (id !== requestId.current) return;
        setItems(data.items);
        setTotal(data.total);
        setPage(1);
      } catch (e) {
        if (id === requestId.current) setError(errorMessage(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchPage],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFirst('initial');
    }, [loadFirst]),
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || items.length >= total) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
      setPage(page + 1);
    } catch (e) {
      if (id === requestId.current) setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, items.length, loading, loadingMore, page, total]);

  return {
    items,
    total,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh: () => loadFirst('refresh'),
    retry: () => {
      setLoading(true);
      void loadFirst('initial');
    },
    loadMore,
  };
}
