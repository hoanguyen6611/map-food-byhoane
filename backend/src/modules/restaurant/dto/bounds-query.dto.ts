import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

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
}
