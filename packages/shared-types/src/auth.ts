// Contract for docs/build-prompts/02-auth.md. Kept in sync with backend
// AuthModule/UserModule DTOs by hand — this package has no build step, so
// backend/mobile/admin-web all import these definitions directly from source.
import type { RoleCode } from './identity';
import type { CuisineCode } from './restaurant';

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OAuthLoginRequest {
  idToken: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  role: RoleCode;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}

export interface AuthResponse extends AuthTokenPair {
  user: AuthUserDto;
}

export interface UserProfileDto {
  displayName: string;
  avatarPhotoId: string | null;
  /** Resolved display URL for `avatarPhotoId`, or null if unset/no longer resolvable. */
  avatarUrl: string | null;
  bio: string | null;
  homeCity: string | null;
  username: string | null;
  // Controls whether this user's real name/avatar show on THEIR reviews as
  // seen by other people — not a general profile-visibility feature, there
  // is still no "view someone else's profile" route.
  isPublic: boolean;
  facebookUrl: string | null;
  instagramUrl: string | null;
  favoriteCuisines: CuisineCode[];
}

// Real-activity-derived level/points/badges — computed live on every `/me`
// fetch from real counts (reviews, contributions, helpful votes received),
// never stored, so it can't drift out of sync. See GamificationService.
export type BadgeCode = 'contributor_10' | 'coffee_hunter' | 'helpful_100';

export interface GamificationDto {
  points: number;
  level: number;
  /** Points still needed to reach `level + 1`; null at the max level. */
  pointsToNextLevel: number | null;
  /** The point threshold `level + 1` starts at; null at the max level. */
  nextLevelThreshold: number | null;
  helpfulVotesReceived: number;
  badges: BadgeCode[];
}

export interface MeResponse {
  user: AuthUserDto;
  profile: UserProfileDto;
  gamification: GamificationDto;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatarPhotoId?: string | null;
  phone?: string;
  bio?: string;
  homeCity?: string;
  username?: string;
  isPublic?: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  favoriteCuisines?: CuisineCode[];
}
