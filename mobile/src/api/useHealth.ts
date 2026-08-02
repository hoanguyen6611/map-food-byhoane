import { useQuery } from '@tanstack/react-query';
import type { HealthResponse } from '@foodmap/shared-types';
import { apiClient } from './client';

/**
 * Small illustrative hook wiring React Query + apiClient + shared-types
 * together end-to-end against the backend's `/health` endpoint. Not a real
 * feature — just proof that the scaffolding (QueryClientProvider, API
 * client, workspace type sharing) works, for later modules to build on.
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.get<HealthResponse>('/health'),
  });
}
