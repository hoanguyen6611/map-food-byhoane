import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContributionListItemDto,
  ContributionListResponse,
  CreateRestaurantContributionRequest,
  StatusReportRequest,
} from '@foodmap/shared-types';
import { contributionsApi } from '../api/contributions';

const DEFAULT_PAGE_SIZE = 20;

/** `GET /me/contributions` — status tracking list, backs a future "My Contributions" screen. */
export function useMyContributions(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  return useQuery<ContributionListResponse>({
    queryKey: ['contributions', page, pageSize],
    queryFn: () => contributionsApi.listMine({ page, pageSize }),
  });
}

/** `GET /contributions/:id` — backs SubmissionStatusScreen; polls every 5s while the item is still undecided. */
export function useContribution(id: string) {
  return useQuery<ContributionListItemDto>({
    queryKey: ['contribution', id],
    queryFn: () => contributionsApi.getById(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'in_review' ? 5000 : false;
    },
  });
}

/** `POST /restaurants/duplicate-check` — not a mutation (no side effect), but not cacheable either (used inline before a real submit). */
export function useDuplicateCheck() {
  return useMutation({
    mutationFn: (input: { lat: number; lng: number; name: string }) => contributionsApi.duplicateCheck(input),
  });
}

export function useCreateRestaurantContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRestaurantContributionRequest) => contributionsApi.createRestaurant(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });
}

export function useCreateStatusReport(restaurantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StatusReportRequest) => contributionsApi.createStatusReport(restaurantId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      queryClient.invalidateQueries({ queryKey: ['restaurantDetail', restaurantId] });
    },
  });
}
