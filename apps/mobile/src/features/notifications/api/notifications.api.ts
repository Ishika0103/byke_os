import type { Notification, Paginated } from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

/** Backend calls for notifications. Mirrors apps/api/src/modules/notifications. */
export const notificationsApi = {
  list: (params: { page?: number; limit?: number; unread?: boolean } = {}) =>
    apiClient.get<Paginated<Notification>>(`/notifications${toQueryString(params)}`),
  unreadCount: () => apiClient.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => apiClient.patch<Notification>(`/notifications/${id}/read`, {}),
  markAllRead: () => apiClient.post<{ count: number }>('/notifications/read-all'),
};
