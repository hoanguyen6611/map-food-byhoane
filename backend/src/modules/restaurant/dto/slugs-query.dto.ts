import { IsString, MaxLength } from 'class-validator';

// Comma-separated, not a repeated `?ids=a&ids=b` param — matches how the
// one caller (web's notifications page, batching a handful of restaurant
// ids from one page of notifications) builds the URL. MaxLength is a cheap
// blunt cap on the whole query string, ahead of the per-id UUID validation
// and count cap RestaurantService.findSlugsByIds applies itself.
export class SlugsQueryDto {
  @IsString()
  @MaxLength(2000)
  ids!: string;
}
