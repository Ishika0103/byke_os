import type {
  CreateRoomTypeInput,
  Paginated,
  RoomType,
  UpdateRoomTypeInput,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type RoomTypeListParams = { page?: number; limit?: number; q?: string; isActive?: boolean };

const base = (hotelId: string) => `/hotels/${hotelId}/room-types`;

/** Backend calls for a hotel's room types. Mirrors apps/api/src/modules/room-types. */
export const roomTypesApi = {
  list: (hotelId: string, params: RoomTypeListParams = {}) =>
    apiClient.get<Paginated<RoomType>>(
      `${base(hotelId)}${toQueryString({ sort: 'name', ...params })}`,
    ),
  get: (hotelId: string, id: string) => apiClient.get<RoomType>(`${base(hotelId)}/${id}`),
  create: (hotelId: string, input: CreateRoomTypeInput) =>
    apiClient.post<RoomType>(base(hotelId), input),
  update: (hotelId: string, id: string, input: UpdateRoomTypeInput) =>
    apiClient.patch<RoomType>(`${base(hotelId)}/${id}`, input),
  remove: (hotelId: string, id: string) => apiClient.delete(`${base(hotelId)}/${id}`),
};
