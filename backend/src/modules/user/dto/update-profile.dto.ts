import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

// VN phone: +84 or 0 prefix followed by 9-10 digits, per docs/01-prd-mvp.md.
const VN_PHONE_REGEX = /^(\+84|0)\d{9,10}$/;
// Lowercase letters/digits/underscore, must start with a letter, 3-24 chars.
const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,23}$/;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarPhotoId?: string | null;

  @IsOptional()
  @Matches(VN_PHONE_REGEX, {
    message: 'phone must be a valid Vietnamese phone number',
  })
  phone?: string;

  // 160, not the old 280 — matches the profile-edit modal's live counter.
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  homeCity?: string;

  @IsOptional()
  @Matches(USERNAME_REGEX, {
    message:
      'username must be 3-24 lowercase letters, digits or underscores, starting with a letter',
  })
  username?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  facebookUrl?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  instagramUrl?: string;

  // Unknown codes are silently dropped server-side (same convention as
  // contribution.service.ts's cuisineCodes handling), not validated here.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  favoriteCuisines?: string[];
}
