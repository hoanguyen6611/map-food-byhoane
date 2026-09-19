import { IsArray, IsString } from 'class-validator';

// Facility codes are no longer a fixed compile-time set (FacilityType used
// to be a Postgres enum — see the facilities lookup table migration) — this
// DTO only checks shape; AdminRestaurantService.replaceFacilities checks
// each code actually exists in the facilities table before writing.
export class ReplaceFacilitiesDto {
  @IsArray()
  @IsString({ each: true })
  facilities!: string[];
}
