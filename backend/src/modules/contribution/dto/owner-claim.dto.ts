import { ArrayMaxSize, IsArray, IsOptional, IsPhoneNumber, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateOwnerClaimDto {
  @IsPhoneNumber('VN')
  contactPhone!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  note!: string;

  // Proof-of-ownership photos (business license, storefront with signage,
  // etc.) — same externally-hosted (ImageKit) URL convention as
  // CreateRestaurantContributionRequest.photoUrls, not the backend
  // Photo-row upload path.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  proofPhotoUrls?: string[];
}
