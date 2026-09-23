import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreateMenuItemDto } from './menu-item.dto';

// Backs admin-web's Excel-import flow (MenuImportDialog.tsx) — the file is
// parsed client-side, so this is just "N of the same CreateMenuItemDto",
// each validated exactly like a single addMenuItem() call would.
export class BulkCreateMenuItemsDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateMenuItemDto)
  items!: CreateMenuItemDto[];
}
