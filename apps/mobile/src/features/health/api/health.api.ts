import { apiClient } from '@/lib/api-client';

export type HealthData = {
  status: string;
  uptime: number;
  database: 'connected' | 'disconnected';
  timestamp: string;
};

export const healthApi = {
  check: () => apiClient.get<HealthData>('/health'),
};
