import { IsDefined, IsIn } from 'class-validator';
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
  'openingHours',
  'facilities',
];

export class CreateEditSuggestionDto {
  @IsIn(EDITABLE_FIELDS)
  fieldName!: EditableRestaurantField;

  @IsDefined()
  newValue!: unknown;
}
