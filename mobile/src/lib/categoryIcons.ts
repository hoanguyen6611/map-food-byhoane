import type { Ionicons } from '@expo/vector-icons';
import { DEFAULT_CATEGORY_ICON_KEY } from '@foodmap/shared-types';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Maps `CategoryDto.icon` (one of shared-types' fixed `CATEGORY_ICON_OPTIONS`
 * keys — the SHAPE is fixed, which category code uses which shape is
 * admin-editable) to an Ionicons glyph for RN, mirroring what
 * category-icons.ts's `getCategoryIconPath` does for web's inline-SVG
 * rendering. Adding a brand-new icon SHAPE needs an entry here too; a
 * brand-new CATEGORY reusing an existing shape does not.
 */
const ICON_KEY_TO_IONICON: Record<string, IoniconName> = {
  noodle_bowl: 'restaurant-outline',
  coffee_cup: 'cafe-outline',
  fine_dining: 'wine-outline',
  food_cart: 'bicycle-outline',
  street_stall: 'storefront-outline',
  cocktail: 'beer-outline',
  hotpot: 'flame-outline',
  vegetarian: 'leaf-outline',
  bakery: 'pizza-outline',
  seafood: 'fish-outline',
  dessert: 'ice-cream-outline',
  bbq: 'flame-outline',
  utensils: 'restaurant-outline',
};

const DEFAULT_IONICON: IoniconName = ICON_KEY_TO_IONICON[DEFAULT_CATEGORY_ICON_KEY] ?? 'restaurant-outline';

/** Resolves a possibly-unset/unrecognized icon key to a renderable Ionicons glyph, never undefined. */
export function getCategoryIonicon(iconKey: string | null | undefined): IoniconName {
  if (!iconKey) return DEFAULT_IONICON;
  return ICON_KEY_TO_IONICON[iconKey] ?? DEFAULT_IONICON;
}
