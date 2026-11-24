import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePagedList } from '@/hooks/use-paged-list';
import { notificationsApi } from '../api/notifications.api';

/** Unread count for the bell; reloads on focus and when the app returns to the foreground. */
export function useUnreadCount(refreshKey = 0) {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then((r) => setCount(r.count))
      .catch(() => undefined);
  }, []);

  useFocusEffect(load);
  useEffect(load, [load, refreshKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  return count;
}

/** Notifications, newest first. */
export function useNotificationList() {
  const fetchPage = useCallback((page: number) => notificationsApi.list({ page, limit: 30 }), []);
  return usePagedList(fetchPage);
}
