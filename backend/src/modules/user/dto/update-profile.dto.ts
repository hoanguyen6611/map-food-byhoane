import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// VN phone: +84 or 0 prefix followed by 9-10 digits, per docs/01-prd-mvp.md.
const VN_PHONE_REGEX = /^(\+84|0)\d{9,10}$/;

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

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  homeCity?: string;
}
