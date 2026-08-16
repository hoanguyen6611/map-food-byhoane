import type {
  CreateReviewRequest,
  MyReviewListResponse,
  ReviewDto,
  ReviewListResponse,
  ReviewSort,
  UpdateReviewRequest,
} from '@foodmap/shared-types';
import { apiClient } from './client';

export interface ReviewListParams {
  sort?: ReviewSort;
  /** Exact-rating filter, 1-5 ("only show N-star reviews"). */
  filter?: number;
  page?: number;
  pageSize?: number;
}

/**
 * `ReviewModule` endpoints (docs/build-prompts/06-reviews-scoring.md). List
 * is public; create/update/delete require auth (handled automatically by
 * `apiClient` attaching the Bearer token when present).
 */
export const reviewsApi = {
  list: (restaurantId: string, params: ReviewListParams = {}) => {
    const query = new URLSearchParams();
    if (params.sort) query.set('sort', params.sort);
    if (params.filter !== undefined) query.set('filter', String(params.filter));
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<ReviewListResponse>(
      `/restaurants/${restaurantId}/reviews${qs ? `?${qs}` : ''}`,
    );
  },

  create: (body: CreateReviewRequest) => apiClient.post<ReviewDto>('/reviews', body),

  update: (id: string, body: UpdateReviewRequest) => apiClient.patch<ReviewDto>(`/reviews/${id}`, body),

  remove: (id: string) => apiClient.delete<void>(`/reviews/${id}`),

  listMine: (params: { page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<MyReviewListResponse>(`/me/reviews${qs ? `?${qs}` : ''}`);
  },
};
