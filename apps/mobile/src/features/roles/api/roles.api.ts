import type { CreateRoleInput, Paginated, Role, UpdateRoleInput } from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type RoleListParams = {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
};

/** Backend calls for roles. Mirrors apps/api/src/modules/roles. */
export const rolesApi = {
  list: (params: RoleListParams = {}) =>
    apiClient.get<Paginated<Role>>(`/roles${toQueryString({ sort: 'name', ...params })}`),
  get: (id: string) => apiClient.get<Role>(`/roles/${id}`),
  create: (input: CreateRoleInput) => apiClient.post<Role>('/roles', input),
  update: (id: string, input: UpdateRoleInput) => apiClient.patch<Role>(`/roles/${id}`, input),
  remove: (id: string) => apiClient.delete(`/roles/${id}`),
};
