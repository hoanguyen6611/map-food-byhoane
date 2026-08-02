import { IsInt, IsOptional, IsUrl } from 'class-validator';

// `ownerType`/`ownerId` are implied by the route (e.g.
// POST /admin/restaurants/:id/photos), not part of the body.
export class AttachPhotoDto {
  @IsUrl({ protocols: ['https'] })
  url!: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;
}
