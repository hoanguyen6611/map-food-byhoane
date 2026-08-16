import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList } from './types';
import { HomeScreen } from '../screens/main/HomeScreen';
import { ExploreScreen } from '../screens/main/ExploreScreen';
import { SavedScreen } from '../screens/main/SavedScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { FloatingTabBar } from './FloatingTabBar';
import { NotificationBellButton } from '../components/NotificationBellButton';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * "Ngon v3" bottom tab bar: Trang chủ (Home), Khám phá (Explore), Đã lưu
 * (Saved), Cá nhân (Profile) — replaces the earlier Map/List/Favorites/
 * Profile IA (build-prompts/03/04/08). "Viết" is a 5th icon rendered by
 * `FloatingTabBar` itself (not a real tab route — see tabConfig.ts), and Map
 * moved off the tab bar entirely (now reached via Explore's "Mở bản đồ").
 */
export function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerRight: () => <NotificationBellButton /> }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('nav.tabHome') }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: t('nav.tabExplore') }} />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ title: t('nav.tabSaved') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.tabProfile') }} />
    </Tab.Navigator>
  );
}
