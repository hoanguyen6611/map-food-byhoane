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
 *     MainTabs    -> MainTabNavigator (Map, List, Favorites, Profile)
 *     Search, SearchResult, Filter, RestaurantDetail, PhotoGallery, Menu,
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
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Map: undefined;
  List: undefined;
  Favorites: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  Search: undefined;
  SearchResult: { query?: string } | undefined;
  Filter: undefined;
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
