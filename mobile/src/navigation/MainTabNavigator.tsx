import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from './types';
import { MapScreen } from '../screens/main/MapScreen';
import { ListScreen } from '../screens/main/ListScreen';
import { FavoritesScreen } from '../screens/main/FavoritesScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Bottom tab bar per docs/03-sitemap-userflow.md §1: Bản đồ (Map),
 * Danh sách (List), Yêu thích (Favorites), Cá nhân (Profile). The floating
 * "+" Add Restaurant action lives above this navigator (pushed from the
 * enclosing MainStack), not as a 5th tab.
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Map" component={MapScreen} options={{ title: 'Bản đồ' }} />
      <Tab.Screen name="List" component={ListScreen} options={{ title: 'Danh sách' }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Yêu thích' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Cá nhân' }} />
    </Tab.Navigator>
  );
}
