import type {
  CreateDepartmentInput,
  Department,
  Paginated,
  UpdateDepartmentInput,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type DepartmentListParams = {
  page?: number;
  limit?: number;
  q?: string;
  isActive?: boolean;
};

/** Backend calls for departments. Mirrors apps/api/src/modules/departments. */
export const departmentsApi = {
  list: (params: DepartmentListParams = {}) =>
    apiClient.get<Paginated<Department>>(
      `/departments${toQueryString({ sort: 'name', ...params })}`,
    ),
  get: (id: string) => apiClient.get<Department>(`/departments/${id}`),
  create: (input: CreateDepartmentInput) => apiClient.post<Department>('/departments', input),
  update: (id: string, input: UpdateDepartmentInput) =>
    apiClient.patch<Department>(`/departments/${id}`, input),
  remove: (id: string) => apiClient.delete(`/departments/${id}`),
};
