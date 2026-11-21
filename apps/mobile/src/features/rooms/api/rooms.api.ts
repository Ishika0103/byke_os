import type {
  BulkCreateRoomsInput,
  CreateRoomInput,
  Paginated,
  Room,
  UpdateRoomInput,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type RoomListParams = {
  page?: number;
  limit?: number;
  q?: string;
  roomTypeId?: string;
  floor?: number;
  isActive?: boolean;
};

const base = (hotelId: string) => `/hotels/${hotelId}/rooms`;

/** Backend calls for a hotel's rooms. Mirrors apps/api/src/modules/rooms. */
export const roomsApi = {
  list: (hotelId: string, params: RoomListParams = {}) =>
    apiClient.get<Paginated<Room>>(`${base(hotelId)}${toQueryString(params)}`),
  get: (hotelId: string, id: string) => apiClient.get<Room>(`${base(hotelId)}/${id}`),
  create: (hotelId: string, input: CreateRoomInput) => apiClient.post<Room>(base(hotelId), input),
  bulkCreate: (hotelId: string, input: BulkCreateRoomsInput) =>
    apiClient.post<{ created: number }>(`${base(hotelId)}/bulk`, input),
  update: (hotelId: string, id: string, input: UpdateRoomInput) =>
    apiClient.patch<Room>(`${base(hotelId)}/${id}`, input),
  remove: (hotelId: string, id: string) => apiClient.delete(`${base(hotelId)}/${id}`),
};
