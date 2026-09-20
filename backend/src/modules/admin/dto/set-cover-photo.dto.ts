import { IsOptional, IsString } from 'class-validator';

// `photoId` omitted/null clears the explicit choice, falling back to the
// oldest-approved-photo default (see Restaurant.coverPhotoId's schema
// comment) — same "unset = old behavior" convention as everywhere else this
// session added an optional override.
export class SetCoverPhotoDto {
  @IsOptional()
  @IsString()
  photoId?: string | null;
}
