import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DuplicateCheckDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
