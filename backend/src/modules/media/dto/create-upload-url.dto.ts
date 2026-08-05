import { IsIn, IsInt, Min } from 'class-validator';
import type { UploadableImageContentType } from '@foodmap/shared-types';

const ALLOWED_CONTENT_TYPES: UploadableImageContentType[] = ['image/jpeg', 'image/png', 'image/webp'];

export class CreateUploadUrlDto {
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: UploadableImageContentType;

  @IsInt()
  @Min(1)
  fileSizeBytes!: number;
}
