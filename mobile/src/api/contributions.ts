import type {
  ContributionListItemDto,
  ContributionListResponse,
  CreateEditSuggestionRequest,
  CreateEditSuggestionResponse,
  CreateRestaurantContributionRequest,
  CreateRestaurantContributionResponse,
  CreateStatusReportResponse,
  DuplicateCandidateDto,
  DuplicateCheckRequest,
  StatusReportRequest,
} from '@foodmap/shared-types';
import { apiClient } from './client';

/** `ContributionModule` endpoints (build-prompts/07) — all require auth. */
export const contributionsApi = {
  duplicateCheck: (body: DuplicateCheckRequest) =>
    apiClient.post<{ candidates: DuplicateCandidateDto[] }>('/restaurants/duplicate-check', body),

  createRestaurant: (body: CreateRestaurantContributionRequest) =>
    apiClient.post<CreateRestaurantContributionResponse>('/restaurants', body),

  createEditSuggestion: (restaurantId: string, body: CreateEditSuggestionRequest) =>
    apiClient.post<CreateEditSuggestionResponse>(`/restaurants/${restaurantId}/edit-suggestions`, body),

  createStatusReport: (restaurantId: string, body: StatusReportRequest) =>
    apiClient.post<CreateStatusReportResponse>(`/restaurants/${restaurantId}/status-reports`, body),

  listMine: (params: { page?: number; pageSize?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<ContributionListResponse>(`/me/contributions${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string) => apiClient.get<ContributionListItemDto>(`/contributions/${id}`),
};
