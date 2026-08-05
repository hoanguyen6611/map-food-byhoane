import { useQuery } from '@tanstack/react-query';
import type { AISummaryResponseDto } from '@foodmap/shared-types';
import { restaurantsApi } from '../api/restaurants';

/** US-J1/J2 — read-side only; `available: false` renders an honest empty state, not an error. */
export function useAiSummary(restaurantId: string) {
  return useQuery<AISummaryResponseDto>({
    queryKey: ['aiSummary', restaurantId],
    queryFn: () => restaurantsApi.aiSummary(restaurantId),
  });
}
