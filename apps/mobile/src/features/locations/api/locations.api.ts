import type { Location, Paginated } from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';

/** Backend calls for locations (read-only for now). Mirrors apps/api/src/modules/locations. */
export const locationsApi = {
  list: () => apiClient.get<Paginated<Location>>('/locations?sort=name&limit=100'),
};
