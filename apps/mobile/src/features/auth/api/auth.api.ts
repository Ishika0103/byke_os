import type { ChangePasswordInput, LoginInput, LoginResponse, User } from '@byke-os/shared';
import { apiClient } from '@/lib/api-client';

/** Backend calls for the auth feature. Mirrors apps/api/src/modules/auth. */
export const authApi = {
  login: (input: LoginInput) =>
    apiClient.post<LoginResponse>('/auth/login', input, { skipAuth: true }),
  me: () => apiClient.get<User>('/auth/me'),
  changePassword: (input: ChangePasswordInput) =>
    apiClient.post<void>('/auth/change-password', input),
};
