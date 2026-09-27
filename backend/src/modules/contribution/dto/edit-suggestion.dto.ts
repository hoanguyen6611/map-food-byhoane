import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { EditableRestaurantField } from '@foodmap/shared-types';

// Deliberately a fixed allow-list, not a fully generic path-based patcher —
// see CreateEditSuggestionRequest's doc comment in shared-types. Covers
// every field the admin edit form already exposes.
const EDITABLE_FIELDS: EditableRestaurantField[] = [
  'name',
  'description',
  'phone',
  'address.line',
  'address.ward',
  'address.district',
  'address.province',
  'location',
  'openingHours',
  'facilities',
  'facebookUrl',
  'instagramUrl',
  'tiktokUrl',
  'websiteUrl',
];

export class CreateEditSuggestionDto {
  @IsIn(EDITABLE_FIELDS)
  fieldName!: EditableRestaurantField;

  @IsDefined()
  newValue!: unknown;

  // Only meaningful when fieldName === 'facilities' — same "+ Thêm mới"
  // convention/cap as CreateRestaurantContributionDto.newFacilityLabels.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  newFacilityLabels?: string[];
}
