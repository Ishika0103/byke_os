import type { CreateHotelInput, Hotel, Paginated, UpdateHotelInput } from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type HotelListParams = {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
};

/** Backend calls for hotels. Mirrors apps/api/src/modules/hotels. */
export const hotelsApi = {
  list: (params: HotelListParams = {}) =>
    apiClient.get<Paginated<Hotel>>(`/hotels${toQueryString({ sort: 'name', ...params })}`),
  get: (id: string) => apiClient.get<Hotel>(`/hotels/${id}`),
  create: (input: CreateHotelInput) => apiClient.post<Hotel>('/hotels', input),
  update: (id: string, input: UpdateHotelInput) => apiClient.patch<Hotel>(`/hotels/${id}`, input),
  remove: (id: string) => apiClient.delete(`/hotels/${id}`),
};
