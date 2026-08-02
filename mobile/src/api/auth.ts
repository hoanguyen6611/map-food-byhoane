import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
} from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * Typed functions for every AuthModule/UserModule endpoint consumed by the
 * mobile app (docs/build-prompts/02-auth.md). Request/response shapes are
 * imported directly from `@foodmap/shared-types` — never hand-rolled — so
 * the mobile client stays in lockstep with the backend contract.
 */
export const authApi = {
  register: (body: RegisterRequest) => apiClient.post<AuthResponse>('/auth/register', body),

  login: (body: LoginRequest) => apiClient.post<AuthResponse>('/auth/login', body),

  refresh: (body: RefreshRequest) => apiClient.post<AuthResponse>('/auth/refresh', body),

  logout: (body: RefreshRequest) => apiClient.post<{ success: true }>('/auth/logout', body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', body),

  resetPassword: (body: ResetPasswordRequest) =>
    apiClient.post<{ success: true }>('/auth/reset-password', body),

  me: () => apiClient.get<MeResponse>('/me'),

  updateProfile: (body: UpdateProfileRequest) => apiClient.patch<MeResponse>('/me/profile', body),

  deleteAccount: () => apiClient.delete<void>('/me'),
};
