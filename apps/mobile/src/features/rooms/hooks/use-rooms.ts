import { usePermission } from '@/features/auth';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLoaded } from '@/hooks/use-loaded';
import { usePagedList } from '@/hooks/use-paged-list';
import { roomTypesApi } from '@/features/room-types';
import { roomsApi } from '../api/rooms.api';

/** Rooms screen: search by number, filter by room type, paging. */
export function useRoomList(hotelId: string, search: string, roomTypeId: string | null) {
  const q = useDebouncedValue(search.trim());
  const fetchPage = useCallback(
    (page: number) =>
      roomsApi.list(hotelId, { page, limit: 50, q, ...(roomTypeId && { roomTypeId }) }),
    [hotelId, q, roomTypeId],
  );
  return usePagedList(fetchPage);
}

export function useRoomDetail(hotelId: string, id: string) {
  const { data, setData, error, retry } = useLoaded(
    () => roomsApi.get(hotelId, id),
    `${hotelId}/${id}`,
  );
  return { room: data, setRoom: setData, error, retry };
}

/**
 * How many room types and rooms a hotel has, for Home and the hotel screen. Only asks for what the
 * user may view (Plan 06): a missing permission just leaves that count out.
 */
export function useRoomCounts(hotelId: string | null | undefined) {
  const [counts, setCounts] = useState<{ roomTypes?: number; rooms?: number } | null>(null);
  const canTypes = usePermission('view-room-type');
  const canRooms = usePermission('view-room');

  useFocusEffect(
    useCallback(() => {
      if (!hotelId || (!canTypes && !canRooms)) return setCounts(null);
      let cancelled = false;
      Promise.all([
        canTypes ? roomTypesApi.list(hotelId, { limit: 1 }) : null,
        canRooms ? roomsApi.list(hotelId, { limit: 1 }) : null,
      ])
        .then(([types, rooms]) => {
          if (!cancelled) setCounts({ roomTypes: types?.total, rooms: rooms?.total });
        })
        .catch(() => !cancelled && setCounts(null));
      return () => {
        cancelled = true;
      };
    }, [hotelId, canTypes, canRooms]),
  );

  return counts;
}
