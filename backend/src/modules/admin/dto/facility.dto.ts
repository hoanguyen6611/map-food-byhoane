import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Same code-shape convention as category.dto.ts — see its comment.
const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

export class CreateFacilityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: 'code phải là chữ thường, số và gạch dưới (vd: wifi)' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string;
}

// code is immutable after creation — RestaurantFacility.facilityCode is a
// literal FK to it, so renaming would break every restaurant that already
// has this facility assigned; only label/icon are editable.
export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  icon?: string;

  // See cuisine.dto.ts's UpdateCuisineDto.isPublic — same reasoning.
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
