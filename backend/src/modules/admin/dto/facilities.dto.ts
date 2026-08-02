import { IsArray, IsIn } from 'class-validator';
import type { FacilityType } from '@foodmap/shared-types';

const FACILITY_TYPES: FacilityType[] = [
  'wifi',
  'parking_car',
  'parking_motorbike',
  'air_conditioner',
  'outdoor_seating',
  'kid_friendly',
  'pet_friendly',
  'card_payment',
  'private_room',
];

// Full-set replacement, same rationale as ReplaceOpeningHoursDto.
export class ReplaceFacilitiesDto {
  @IsArray()
  @IsIn(FACILITY_TYPES, { each: true })
  facilities!: FacilityType[];
}
