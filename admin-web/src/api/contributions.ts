/**
 * Owner-facing slice of the community Contribution endpoints
 * (backend's ContributionController, shared with the public web/mobile
 * contributor flow — no admin-only variant). Owner-submitted restaurant
 * edits go through this same one-field-per-submission edit_suggestion
 * pipeline as any other contributor's edit — see
 * OwnerRestaurantEditPage.tsx's diff-based submit loop.
 */
import type {
  CreateEditSuggestionRequest,
  CreateEditSuggestionResponse,
  ResolveMapLinkResponse,
} from '@foodmap/shared-types'
import { apiClient } from './client'

export const contributionsApi = {
  createEditSuggestion: (restaurantId: string, body: CreateEditSuggestionRequest) =>
    apiClient.post<CreateEditSuggestionResponse>(`/restaurants/${restaurantId}/edit-suggestions`, body),

  resolveMapLink: (url: string) =>
    apiClient.post<ResolveMapLinkResponse>('/restaurants/resolve-map-link', { url }),
}
