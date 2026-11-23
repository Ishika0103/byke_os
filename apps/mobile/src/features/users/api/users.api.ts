import type {
  CreateUserInput,
  Paginated,
  ResetPasswordInput,
  UpdateUserInput,
  User,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type UserListParams = {
  page?: number;
  limit?: number;
  q?: string;
  roleId?: string;
  hotelId?: string;
  isActive?: boolean;
};

/** All backend calls for the users feature. Mirrors apps/api/src/modules/users. */
export const usersApi = {
  list: (params: UserListParams = {}) =>
    apiClient.get<Paginated<User>>(`/users${toQueryString({ sort: 'name', ...params })}`),
  get: (id: string) => apiClient.get<User>(`/users/${id}`),
  create: (input: CreateUserInput) => apiClient.post<User>('/users', input),
  update: (id: string, input: UpdateUserInput) => apiClient.patch<User>(`/users/${id}`, input),
  remove: (id: string) => apiClient.delete(`/users/${id}`),
  resetPassword: (id: string, input: ResetPasswordInput) =>
    apiClient.post<void>(`/users/${id}/reset-password`, input),
};
