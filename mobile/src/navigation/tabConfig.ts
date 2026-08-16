import type { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from './types';

/** Shared between `MainTabNavigator` (screen options) and `FloatingTabBar` (custom bar rendering). */
export const TAB_ICONS: Record<
  keyof MainTabParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Explore: { focused: 'compass', unfocused: 'compass-outline' },
  Saved: { focused: 'heart', unfocused: 'heart-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

export const TAB_LABEL_KEYS: Record<keyof MainTabParamList, string> = {
  Home: 'nav.tabHome',
  Explore: 'nav.tabExplore',
  Saved: 'nav.tabSaved',
  Profile: 'nav.tabProfile',
};

/**
 * "Viết" (write a review) — not a real tab route (`MainTabParamList` has no
 * `Write` entry; writing a review always needs a restaurant picked first, so
 * it's a shortcut into the existing Search flow, not a screen of its own).
 * `FloatingTabBar` renders this as a 5th icon between Explore and Saved,
 * matching the mockup's nav order, and its `goWrite()` navigates the PARENT
 * stack (`SearchResult`, mode: 'writeReview' — skips straight past the plain
 * Search text-input screen since an empty query already shows a real browse
 * list) rather than switching tabs.
 */
export const WRITE_TAB_ICON = { focused: 'add-circle' as const, unfocused: 'add-circle-outline' as const };
export const WRITE_TAB_LABEL_KEY = 'nav.tabWrite';

/**
 * `FloatingTabBar`'s own pill height + its gap above the safe-area bottom
 * inset. Screens with content or floating buttons near the bottom edge
 * (Home/Explore/Saved/Profile's scroll content) add this on top of
 * `useSafeAreaInsets().bottom` so the floating bar never occludes them. Map
 * no longer needs this — it moved off the tab bar (now a pushed stack
 * screen, see MainStackNavigator), so the floating bar is never visible
 * behind it.
 */
export const FLOATING_TAB_BAR_CLEARANCE = 68 + 16 + 12;
