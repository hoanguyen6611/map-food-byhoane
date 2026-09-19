// Curated icon set for RestaurantCategory.icon — a fixed key (not a raw SVG
// path/emoji) so admin's category picker stays a visual dropdown instead of
// requiring SVG/design knowledge, while every icon still matches the app's
// existing 24x24, stroke-1.5, monochrome outline style. Adding a brand-new
// SHAPE still needs a code change here; adding a brand-new CATEGORY that
// reuses one of these shapes does not — that's the actual problem this
// solves (RestaurantCategoryCode's grid used to be hardcoded to exactly the
// 6 launch categories, see web/src/lib/labels.ts's old CATEGORY_OPTIONS).
export interface CategoryIconOption {
  key: string;
  /** Vietnamese label shown in the admin icon picker. */
  label: string;
  /** SVG path `d` attribute, 24x24 viewBox, matches icons.tsx's <Base> conventions. */
  path: string;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { key: 'noodle_bowl', label: 'Món ăn', path: 'M7 4v16M17 4v6a3 3 0 0 1-3 3h-1M12 4v6' },
  { key: 'coffee_cup', label: 'Cà phê', path: 'M5 6h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 8h2a2 2 0 0 1 0 4h-2M4 21h13' },
  { key: 'fine_dining', label: 'Nhà hàng', path: 'M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM8 6l1-2M12 6l1-2M16 6l1-2' },
  { key: 'food_cart', label: 'Xe đẩy', path: 'M4 8h11v7H4zM15 11h3l2 4h-5zM7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z' },
  { key: 'street_stall', label: 'Quán vỉa hè', path: 'M3 10h18l-2-4H5zM5 10v10M19 10v10M9 20v-5h6v5' },
  { key: 'cocktail', label: 'Quầy bar', path: 'M5 5h14l-7 7v7M9 19h6' },
  { key: 'hotpot', label: 'Lẩu', path: 'M4 12h16v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5zM2 13h2M20 13h2M12 12V9M9 12c0-2 1-3 3-3s3 1 3 3' },
  { key: 'vegetarian', label: 'Chay', path: 'M12 21C7 21 4 16 4 11c0-4 3-7 7-7 1 4 3 7 7 8 0 5-2 9-6 9zM8 8c2 3 4 8 4 13' },
  { key: 'bakery', label: 'Bánh / Bakery', path: 'M4 20h16M4 20a8 6 0 0 1 16 0M9 12l1 4M14 11l1 5' },
  { key: 'seafood', label: 'Hải sản', path: 'M2 12c3-5 7-5 10-5s7 0 10 5c-3 5-7 5-10 5s-7 0-10-5zM19 9.5l3-2.5v10l-3-2.5M6.5 11.5h.01' },
  { key: 'dessert', label: 'Tráng miệng', path: 'M6 11a6 4 0 0 1 12 0zM9 11l3 10 3-10z' },
  { key: 'bbq', label: 'Nướng / BBQ', path: 'M4 16h16M4 12h16M6 16v4M18 16v4M8 8c0-2 2-2 2-4M14 8c0-2 2-2 2-4' },
  { key: 'utensils', label: 'Mặc định', path: 'M5 3v6M7 3v6M9 3v6M7 9v12M17 3c-3 1-3 4-3 6 0 1 1 2 3 2v10' },
];

export const DEFAULT_CATEGORY_ICON_KEY = 'utensils';

const CATEGORY_ICON_PATH_BY_KEY = new Map(CATEGORY_ICON_OPTIONS.map((o) => [o.key, o.path]));
const DEFAULT_CATEGORY_ICON_PATH = CATEGORY_ICON_PATH_BY_KEY.get(DEFAULT_CATEGORY_ICON_KEY)!;

/** Resolves a possibly-unset/unrecognized icon key to a renderable SVG path, never null. */
export function getCategoryIconPath(iconKey: string | null | undefined): string {
  if (!iconKey) return DEFAULT_CATEGORY_ICON_PATH;
  return CATEGORY_ICON_PATH_BY_KEY.get(iconKey) ?? DEFAULT_CATEGORY_ICON_PATH;
}
