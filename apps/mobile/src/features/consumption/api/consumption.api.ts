import type {
  Consumption,
  ConsumptionModule,
  ConsumptionSummary,
  ConsumptionSyncResult,
  Paginated,
} from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';
import { toQueryString } from '@/lib/query-string';

export type ConsumptionListParams = {
  hotelId?: string;
  from?: string;
  to?: string;
  date?: string;
  module?: string;
  page?: number;
  limit?: number;
};

/** Backend calls for consumption. Mirrors apps/api/src/modules/consumption. */
export const consumptionApi = {
  modules: () => apiClient.get<ConsumptionModule[]>('/consumption-modules'),
  summary: (date: string) =>
    apiClient.get<ConsumptionSummary>(`/consumption/summary${toQueryString({ date })}`),
  list: (params: ConsumptionListParams = {}) =>
    apiClient.get<Paginated<Consumption>>(`/consumption${toQueryString(params)}`),
  /** preview = true reads the sheet and reports, saving nothing. */
  sync: (preview: boolean) =>
    apiClient.post<ConsumptionSyncResult>(`/consumption/sync?preview=${preview}`),
};
