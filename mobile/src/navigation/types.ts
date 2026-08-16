import type { NavigatorScreenParams } from '@react-navigation/native';
import type { RestaurantCategoryCode } from '@foodmap/shared-types';

/**
 * Typed navigation graph matching the sitemap in docs/03-sitemap-userflow.md
 * §1 and the screen list in docs/04-screen-list.md. Structure:
 *
 *   RootStack
 *     Splash
 *     Onboarding
 *     PermissionLocation
 *     Auth        -> AuthStack (Login, Register, ForgotPassword)
 *     Main        -> MainStack (MainTabs + all screens pushed on top of tabs)
 *
 *   MainStack
 *     MainTabs    -> MainTabNavigator (Home, Explore, Saved, Profile — "Ngon
 *                    v3" 5-icon nav; Write is a FloatingTabBar-only shortcut
 *                    into Search, not a real tab route, see tabConfig.ts)
 *     Search, SearchResult, Filter, Map, RestaurantDetail, PhotoGallery, Menu,
 *     Reviews, WriteReview, AddRestaurant, SelectLocation, UploadMedia,
 *     SubmissionStatus, EditProfile, Notifications, Settings, ReportContent
 *
 * Param shapes are intentionally minimal (id-only where an entity is
 * involved) — this module scaffolds the navigation graph only, no real
 * business logic (Module 1 scope, see docs/build-prompts/01-foundations.md).
 */

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  PermissionLocation: undefined;
  Auth: undefined;
  // NavigatorScreenParams (not `undefined`) — lets a top-level navigationRef
  // (App.tsx's push-notification tap handler, which sits above MainStack)
  // deep-link straight into a MainStack screen via
  // navigationRef.navigate('Main', { screen: 'Reviews', params: {...} }).
  // Still accepts plain `navigate('Main')` with no params (existing call
  // sites), since NavigatorScreenParams<T> | undefined allows both.
  Main: NavigatorScreenParams<MainStackParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Saved: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  // `mode`/`category` — forwarded from SearchResult's "Sửa tìm kiếm" button so
  // re-submitting a query doesn't drop write-review-pick mode or an active
  // category filter (see SearchResultScreen.tsx and SearchScreen.tsx).
  Search: { mode?: 'writeReview'; category?: RestaurantCategoryCode } | undefined;
  // `mode: 'writeReview'` — reached via FloatingTabBar's "Viết" shortcut:
  // tapping a result here pushes WriteReview instead of RestaurantDetail
  // (see SearchResultScreen.tsx), turning this same search flow into the
  // "pick a restaurant to review" step rather than building a separate picker.
  // `category` — set when arriving from a Home/Explore category chip/tile.
  SearchResult: { query?: string; mode?: 'writeReview'; category?: RestaurantCategoryCode } | undefined;
  Filter: undefined;
  Map: undefined;
  RestaurantDetail: { restaurantId: string };
  PhotoGallery: { restaurantId: string };
  Menu: { restaurantId: string };
  Reviews: { restaurantId: string };
  WriteReview: { restaurantId: string };
  AddRestaurant: undefined;
  SelectLocation: undefined;
  UploadMedia: undefined;
  SubmissionStatus: { contributionId: string };
  EditProfile: undefined;
  MyReviews: undefined;
  MyContributions: undefined;
  Notifications: undefined;
  Settings: undefined;
  ReportContent: { targetType: 'restaurant' | 'review'; targetId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
