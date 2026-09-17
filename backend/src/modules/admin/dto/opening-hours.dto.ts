import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:mm", 24h

export class OpeningHourEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  // "HH:mm" strings, converted to Date(1970-01-01THH:mm) in the service —
  // simpler for admin-web to submit than a full ISO datetime for a
  // day-of-week-relative time-of-day value.
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'openTime must be HH:mm (24h)' })
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'closeTime must be HH:mm (24h)' })
  closeTime?: string;

  @IsBoolean()
  isClosed!: boolean;
}

// Full 7-day replacement in one call — matches admin-web's "7-day grid" UI
// (docs/build-prompts/05's scope note) better than 7 separate PATCH calls.
export class ReplaceOpeningHoursDto {
  @ValidateNested({ each: true })
  @Type(() => OpeningHourEntryDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  days!: OpeningHourEntryDto[];
}
