import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SearchScreen } from '../screens/main/SearchScreen';
import { SearchResultScreen } from '../screens/main/SearchResultScreen';
import { FilterScreen } from '../screens/main/FilterScreen';
import { MapScreen } from '../screens/main/MapScreen';
import { RestaurantDetailScreen } from '../screens/main/RestaurantDetailScreen';
import { PhotoGalleryScreen } from '../screens/main/PhotoGalleryScreen';
import { MenuScreen } from '../screens/main/MenuScreen';
import { ReviewsScreen } from '../screens/main/ReviewsScreen';
import { WriteReviewScreen } from '../screens/main/WriteReviewScreen';
import { AddRestaurantScreen } from '../screens/main/AddRestaurantScreen';
import { SelectLocationScreen } from '../screens/main/SelectLocationScreen';
import { UploadMediaScreen } from '../screens/main/UploadMediaScreen';
import { SubmissionStatusScreen } from '../screens/main/SubmissionStatusScreen';
import { EditProfileScreen } from '../screens/main/EditProfileScreen';
import { MyReviewsScreen } from '../screens/main/MyReviewsScreen';
import { MyContributionsScreen } from '../screens/main/MyContributionsScreen';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { ReportContentScreen } from '../screens/main/ReportContentScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Wraps the bottom tab navigator (`MainTabs`) plus every screen reachable
 * by pushing on top of the tabs, per the sitemap's Main Tab Navigation
 * subgraph and screen-to-screen navigation matrix
 * (docs/03-sitemap-userflow.md §1, §3).
 */
export function MainStackNavigator() {
  const { t } = useTranslation();
  return (
    // `headerBackButtonDisplayMode: 'minimal'` drops the back button's text
    // label app-wide (chevron only) — without it, native-stack falls back to
    // the previous screen's raw route NAME when that screen has no title
    // (MainTabs renders `headerShown: false`, so it has none), showing the
    // literal internal string "MainTabs" as back-button text instead of
    // anything a user would recognize.
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: t('nav.search') }} />
      <Stack.Screen name="SearchResult" component={SearchResultScreen} options={{ title: t('nav.searchResult') }} />
      <Stack.Screen
        name="Filter"
        component={FilterScreen}
        options={{ title: t('nav.filter'), presentation: 'modal' }}
      />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: t('nav.map') }} />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{ title: t('nav.restaurantDetail') }}
      />
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={{ title: t('nav.photoGallery') }}
      />
      <Stack.Screen name="Menu" component={MenuScreen} options={{ title: t('nav.menu') }} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ title: t('nav.reviews') }} />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: t('nav.writeReview'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddRestaurant"
        component={AddRestaurantScreen}
        options={{ title: t('nav.addRestaurant'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="SelectLocation"
        component={SelectLocationScreen}
        options={{ title: t('nav.selectLocation') }}
      />
      <Stack.Screen
        name="UploadMedia"
        component={UploadMediaScreen}
        options={{ title: t('nav.uploadMedia') }}
      />
      <Stack.Screen
        name="SubmissionStatus"
        component={SubmissionStatusScreen}
        options={{ title: t('nav.submissionStatus') }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: t('nav.editProfile') }}
      />
      <Stack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: t('nav.myReviews') }} />
      <Stack.Screen name="MyContributions" component={MyContributionsScreen} options={{ title: t('nav.myContributions') }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: t('nav.notifications') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
      <Stack.Screen
        name="ReportContent"
        component={ReportContentScreen}
        options={{ title: t('nav.reportContent'), presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
