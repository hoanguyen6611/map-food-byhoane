import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateReviewRequest, MyReviewListResponse, ReviewListResponse, ReviewSort, UpdateReviewRequest } from '@foodmap/shared-types';
import { reviewsApi } from '../api/reviews';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_MY_REVIEWS_PAGE_SIZE = 20;

/** `GET /me/reviews` — backs the Profile "My Reviews" screen. */
export function useMyReviews(page = 1, pageSize = DEFAULT_MY_REVIEWS_PAGE_SIZE) {
  return useQuery<MyReviewListResponse>({
    queryKey: ['myReviews', page, pageSize],
    queryFn: () => reviewsApi.listMine({ page, pageSize }),
  });
}

/**
 * `GET /restaurants/:id/reviews` (build-prompts/06). Page-number pagination
 * (not infinite-scroll) — simpler to reason about for the "All / N★" filter
 * + sort combo, and the backend already returns `total`/`page`/`pageSize`
 * for a page-button UI to key off of directly.
 */
export function useReviewList(
  restaurantId: string,
  options: { sort?: ReviewSort; filter?: number; page?: number } = {},
) {
  const { sort = 'newest', filter, page = 1 } = options;
  return useQuery<ReviewListResponse>({
    queryKey: ['reviews', restaurantId, sort, filter ?? null, page],
    queryFn: () => reviewsApi.list(restaurantId, { sort, filter, page, pageSize: DEFAULT_PAGE_SIZE }),
    enabled: Boolean(restaurantId),
  });
}

/**
 * Invalidates both this restaurant's review list (every sort/filter/page
 * variant) and its detail cache (`compositeScore`/`reviewCount`/preview
 * `reviews[]` all live there) so both screens refresh after a write.
 */
function useInvalidateReviews(restaurantId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['reviews', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['restaurantDetail', restaurantId] });
    queryClient.invalidateQueries({ queryKey: ['myReviews'] });
  };
}

export function useCreateReview(restaurantId: string) {
  const invalidate = useInvalidateReviews(restaurantId);
  return useMutation({
    mutationFn: (body: CreateReviewRequest) => reviewsApi.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateReview(restaurantId: string) {
  const invalidate = useInvalidateReviews(restaurantId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReviewRequest }) => reviewsApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteReview(restaurantId: string) {
  const invalidate = useInvalidateReviews(restaurantId);
  return useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: invalidate,
  });
}
