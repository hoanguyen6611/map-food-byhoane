import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Same code-shape convention as category.dto.ts/facility.dto.ts.
const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

export class CreateCuisineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: 'code phải là chữ thường, số và gạch dưới (vd: mon_viet)' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;
}

// code is immutable after creation — RestaurantCuisine/Dish reference this
// row by id (not code), but search's raw-SQL cuisine filter and every
// existing restaurant's cuisineCodes match on `code`; only label is
// editable, same reasoning as category/facility (no `icon` column on
// Cuisine, unlike those two).
export class UpdateCuisineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  // Lets an admin manually publish a contributor-proposed ("+ Thêm mới")
  // cuisine early, independent of the restaurant's own approval decision —
  // or hide one back if it turns out to be junk.
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
