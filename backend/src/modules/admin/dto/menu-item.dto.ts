import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(10_000_000) // sanity cap per docs/01-prd-mvp.md §7 "giá bất thường"
  priceVnd!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  priceVnd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;
}
