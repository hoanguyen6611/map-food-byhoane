import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CATEGORY_ICON_OPTIONS } from '@foodmap/shared-types';

// snake_case identifier — same shape convention as the values this replaces
// ('quan_an', 'quan_ca_phe', …), since `code` is what search filters and
// FK references use as the stable key, not the (freely editable) label.
const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

// `icon` is a fixed key into CATEGORY_ICON_OPTIONS (a curated, code-defined
// icon shape set), not a free-text SVG path or emoji — keeps admin's picker
// a visual dropdown instead of requiring design/SVG knowledge. See that
// file's comment for why new CATEGORIES don't need a code change but new
// icon SHAPES still do.
const CATEGORY_ICON_KEYS = CATEGORY_ICON_OPTIONS.map((o) => o.key);

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(CODE_PATTERN, { message: 'code phải là chữ thường, số và gạch dưới (vd: quan_an)' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsIn(CATEGORY_ICON_KEYS, { message: 'icon không hợp lệ' })
  icon?: string;
}

// code is immutable after creation — it's referenced by Restaurant.categoryId
// (FK) and by search filters, so renaming it out from under existing data
// would silently break both; only label/icon are editable.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsIn(CATEGORY_ICON_KEYS, { message: 'icon không hợp lệ' })
  icon?: string;
}
