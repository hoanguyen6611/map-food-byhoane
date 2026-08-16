// Contract for docs/build-prompts/02-auth.md. Kept in sync with backend
// AuthModule/UserModule DTOs by hand — this package has no build step, so
// backend/mobile/admin-web all import these definitions directly from source.
import type { RoleCode } from './identity';

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
}

export interface MeResponse {
  user: AuthUserDto;
  profile: UserProfileDto;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatarPhotoId?: string | null;
  phone?: string;
  bio?: string;
  homeCity?: string;
}
