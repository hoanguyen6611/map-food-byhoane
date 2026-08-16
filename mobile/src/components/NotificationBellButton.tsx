import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { MainStackParamList } from '../navigation/types';
import { useNotificationsList } from '../hooks/useNotifications';
import { useTheme, type ThemeColors } from '../theme/ThemeContext';

// Shared header-right button for every MainTabs screen (Map/List/Favorites/
// Profile) — see MainTabNavigator's `screenOptions.headerRight`. Previously
// this was a single row buried in Profile's own menu; moved up to the
// navbar so it's reachable from any tab, not just Profile.
export function NotificationBellButton() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<MainStackParamList>>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  // pageSize: 1 keeps this cheap — only `unreadCount` (not the items) is used,
  // same rationale as ProfileScreen's previous badge query.
  const notificationsQuery = useNotificationsList(1, 1);
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <Pressable
      style={styles.button}
      onPress={() => navigation.navigate('Notifications')}
      accessibilityRole="button"
      accessibilityLabel={t('nav.notifications')}
      hitSlop={8}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: { paddingHorizontal: 12, paddingVertical: 4 },
    badge: {
      position: 'absolute',
      top: -2,
      right: 6,
      minWidth: 16,
      height: 16,
      borderRadius: 999,
      paddingHorizontal: 3,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.onPrimary, fontSize: 9, fontWeight: '700' },
  });
