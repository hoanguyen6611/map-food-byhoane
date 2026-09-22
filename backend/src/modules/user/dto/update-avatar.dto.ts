import { IsOptional, IsUrl } from 'class-validator';

// null clears the avatar back to the initials fallback ("Dùng chữ viết tắt").
export class UpdateAvatarDto {
  @IsOptional()
  @IsUrl()
  photoUrl?: string | null;
}
