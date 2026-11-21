import { useCallback, useEffect, useState } from 'react';

import type { Option } from '@/components/ui/option-dialog';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLoaded } from '@/hooks/use-loaded';
import { usePagedList } from '@/hooks/use-paged-list';
import { roomTypesApi } from '../api/room-types.api';

/** Room types screen: search (name, code, PMS code) + paging. */
export function useRoomTypeList(hotelId: string, search: string) {
  const q = useDebouncedValue(search.trim());
  const fetchPage = useCallback(
    (page: number) => roomTypesApi.list(hotelId, { page, limit: 30, q }),
    [hotelId, q],
  );
  return usePagedList(fetchPage);
}

export function useRoomTypeDetail(hotelId: string, id: string) {
  const { data, setData, error, retry } = useLoaded(
    () => roomTypesApi.get(hotelId, id),
    `${hotelId}/${id}`,
  );
  return { roomType: data, setRoomType: setData, error, retry };
}

/**
 * The hotel's room types as drawer options ("Deluxe Room", "DLX · 20 rooms").
 * `activeOnly` for choosing a type for a room; all types for filtering the rooms list.
 */
export function useRoomTypeOptions(hotelId: string, activeOnly = true) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    roomTypesApi
      .list(hotelId, { limit: 100, ...(activeOnly && { isActive: true }) })
      .then((page) => {
        if (cancelled) return;
        setOptions(
          page.items.map((t) => ({
            value: t.id,
            label: t.name,
            description: `${t.code} · ${t.roomCount === 1 ? '1 room' : `${t.roomCount} rooms`}`,
          })),
        );
      })
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hotelId, activeOnly]);

  return { options, loading };
}
