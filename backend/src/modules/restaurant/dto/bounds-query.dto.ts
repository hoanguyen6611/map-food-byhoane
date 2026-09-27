import { Transform, Type } from 'class-transformer';
import { IsArray, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

// Same optional filter surface as SearchQueryDto (minus q/lat-lng-radius/sort/
// paging, which don't apply to a fixed-viewport browse) — the Map screen's
// Filter modal writes into the same filterStore SearchResult/Home read, so
// the map should respect the same criteria instead of silently ignoring
// anything beyond its own quick chips (openNow/price/minRating, which stay
// client-side since RestaurantSummaryDto already carries those fields).
export class BoundsQueryDto {
  @Type(() => Number)
  @IsLatitude()
  swLat!: number;

  @Type(() => Number)
  @IsLongitude()
  swLng!: number;

  @Type(() => Number)
  @IsLatitude()
  neLat!: number;

  @Type(() => Number)
  @IsLongitude()
  neLng!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @IsString({ each: true })
  cuisine?: string[];

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  ward?: string;
}
