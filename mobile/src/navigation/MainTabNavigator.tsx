import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { MainTabParamList } from './types';
import { MapScreen } from '../screens/main/MapScreen';
import { ListScreen } from '../screens/main/ListScreen';
import { FavoritesScreen } from '../screens/main/FavoritesScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }
> = {
  Map: { focused: 'map', unfocused: 'map-outline' },
  List: { focused: 'list', unfocused: 'list-outline' },
  Favorites: { focused: 'heart', unfocused: 'heart-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

/**
 * Bottom tab bar per docs/03-sitemap-userflow.md §1: Bản đồ (Map),
 * Danh sách (List), Yêu thích (Favorites), Cá nhân (Profile). The floating
 * "+" Add Restaurant action lives above this navigator (pushed from the
 * enclosing MainStack), not as a 5th tab.
 */
export function MainTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name].focused : TAB_ICONS[route.name].unfocused} size={size} color={color} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} options={{ title: 'Bản đồ' }} />
      <Tab.Screen name="List" component={ListScreen} options={{ title: 'Danh sách' }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Yêu thích' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Cá nhân' }} />
    </Tab.Navigator>
  );
}
