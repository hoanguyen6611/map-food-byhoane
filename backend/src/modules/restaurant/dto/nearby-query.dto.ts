import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class NearbyQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  // Default 3km. Deliberately NOT capped here with @Max: a request for
  // 50km must still succeed (200) with results silently clamped to the
  // 20km hard cap, per docs/build-prompts/03-map-geospatial.md Definition
  // of Done ("radius cap enforcement... returns data capped to 20km
  // behavior") — a validation error would be the wrong contract. The actual
  // clamp happens in RestaurantService, which is the one true enforcement
  // point regardless of what any caller requests.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radiusKm?: number;
}
