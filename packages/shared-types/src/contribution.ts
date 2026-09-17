// Contract for docs/build-prompts/07-contribution-media-moderation-ai.md's
// ContributionModule — the community submission flow (add restaurant, edit
// suggestions, status reports). Moderation is the rule-based stand-in
// (ContributionModerationService), not a real AIGateway call this pass.
import type { LocationDto, OpeningHourDto } from './restaurant-detail';
import type { CuisineCode, FacilityType, PriceRangeCode, RestaurantCategoryCode } from './restaurant';

export type ContributionType = 'new_restaurant' | 'edit_suggestion' | 'status_update' | 'closure_report';
export type ContributionStatus = 'pending' | 'auto_approved' | 'in_review' | 'approved' | 'rejected' | 'edit_requested';

export interface DuplicateCandidateDto {
  id: string;
  name: string;
  fullAddressText: string;
  distanceMeters: number;
  similarity: number;
}

export interface DuplicateCheckRequest {
  lat: number;
  lng: number;
  name: string;
}

export interface DuplicateCheckResponse {
  candidates: DuplicateCandidateDto[];
}

export interface MenuItemInputDto {
  name: string;
  priceVnd: number;
  category?: string;
  isPopular?: boolean;
}

// District was dropped from Vietnam's administrative hierarchy in 2025 —
// new address submissions only collect line/ward/province (ward is now
// mandatory, unlike the legacy AddressDto's nullable `ward`). This is
// intentionally its own type rather than `Omit<AddressDto, ...>` since the
// request/response shapes have diverged (no district, ward required).
export interface CreateRestaurantAddressInput {
  line: string;
  ward: string;
  province: string;
}

export interface CreateRestaurantContributionRequest {
  name: string;
  description?: string;
  categoryCode: RestaurantCategoryCode;
  priceRangeCode?: PriceRangeCode;
  phone?: string;
  address: CreateRestaurantAddressInput;
  location: LocationDto;
  cuisineCodes?: CuisineCode[];
  openingHours?: OpeningHourDto[];
  facilities?: FacilityType[];
  menuItems?: MenuItemInputDto[];
  // At least one photo required across photoIds+photoUrls combined —
  // enforced server-side, not just by this type. `photoIds` are backend
  // Photo rows created via the S3-backed MediaModule upload flow (get
  // re-encoded + AI-moderated); `photoUrls` are externally-hosted photos
  // (currently: the web app's ImageKit.io upload flow) attached directly
  // by URL, deliberately bypassing that pipeline — see MediaService.attachExternalUrls.
  photoIds?: string[];
  photoUrls?: string[];
  // Must be true to proceed past a 409 duplicate-candidates response.
  duplicateConfirmed?: boolean;
}

export interface CreateRestaurantContributionResponse {
  restaurantId: string;
  contributionId: string;
  status: ContributionStatus;
}

// Deliberately a fixed allow-list, not a fully generic path-based patcher —
// covers every field the admin edit form already exposes.
export type EditableRestaurantField =
  | 'name'
  | 'description'
  | 'phone'
  | 'address.line'
  | 'address.ward'
  | 'address.district'
  | 'address.province'
  | 'openingHours'
  | 'facilities';

export interface CreateEditSuggestionRequest {
  fieldName: EditableRestaurantField;
  newValue: unknown;
}

export interface CreateEditSuggestionResponse {
  contributionId: string;
  status: ContributionStatus;
}

export type CrowdedLevel = 'empty' | 'light' | 'moderate' | 'crowded' | 'full';
export type SeatAvailabilityLevel = 'plenty' | 'limited' | 'full';
export type PowerOutletLevel = 'plenty' | 'some' | 'none';

// Discriminated union — `kind` determines which fields are relevant.
// hours_change/moved/wrong_info/closure never auto-apply to the live
// restaurant regardless of moderation outcome (PRD: "does not auto-hide").
export type StatusReportRequest =
  | { kind: 'crowded'; level: CrowdedLevel }
  | { kind: 'seat'; level: SeatAvailabilityLevel }
  | { kind: 'outlet'; level: PowerOutletLevel }
  | { kind: 'parking'; hasCarParking: boolean; hasMotorbikeParking: boolean; isFree?: boolean; notes?: string }
  | { kind: 'hours_change' | 'moved' | 'wrong_info'; description: string }
  | { kind: 'closure'; description?: string };

export interface CreateStatusReportResponse {
  contributionId: string;
  status: ContributionStatus;
}

export interface ContributionListItemDto {
  id: string;
  type: ContributionType;
  targetRestaurantId: string | null;
  targetRestaurantName: string | null;
  status: ContributionStatus;
  aiReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionListResponse {
  items: ContributionListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}
