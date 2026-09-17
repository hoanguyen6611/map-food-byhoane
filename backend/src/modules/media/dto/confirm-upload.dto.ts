import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { MediaOwnerType } from '@foodmap/shared-types';

const OWNER_TYPES: MediaOwnerType[] = [
  'restaurant',
  'review',
  'contribution',
  'user_profile',
];

export class ConfirmUploadDto {
  @IsString()
  storageKey!: string;

  @IsIn(OWNER_TYPES)
  ownerType!: MediaOwnerType;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
