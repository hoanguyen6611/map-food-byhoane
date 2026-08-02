import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { SearchScreen } from '../screens/main/SearchScreen';
import { SearchResultScreen } from '../screens/main/SearchResultScreen';
import { FilterScreen } from '../screens/main/FilterScreen';
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
  return (
    <Stack.Navigator>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="SearchResult" component={SearchResultScreen} options={{ title: 'Search Result' }} />
      <Stack.Screen name="Filter" component={FilterScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{ title: 'Restaurant Detail' }}
      />
      <Stack.Screen
        name="PhotoGallery"
        component={PhotoGalleryScreen}
        options={{ title: 'Photo Gallery' }}
      />
      <Stack.Screen name="Menu" component={MenuScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Write Review', presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddRestaurant"
        component={AddRestaurantScreen}
        options={{ title: 'Add Restaurant', presentation: 'modal' }}
      />
      <Stack.Screen
        name="SelectLocation"
        component={SelectLocationScreen}
        options={{ title: 'Select Location' }}
      />
      <Stack.Screen name="UploadMedia" component={UploadMediaScreen} options={{ title: 'Upload Media' }} />
      <Stack.Screen
        name="SubmissionStatus"
        component={SubmissionStatusScreen}
        options={{ title: 'Submission Status' }}
      />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="ReportContent"
        component={ReportContentScreen}
        options={{ title: 'Report Content', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
