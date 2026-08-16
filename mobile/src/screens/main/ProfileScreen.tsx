import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { authApi } from '../../api/auth';
import { secureStorage } from '../../lib/secureStorage';
import { unregisterPushNotificationsAsync } from '../../lib/pushNotifications';
import { useAuthStore } from '../../store/authStore';
import { useMyReviews } from '../../hooks/useReviews';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../navigation/tabConfig';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<MainStackParamList>
>;

// Static placeholders — no backend aggregate for photo count or likes
// received anywhere (see the reskin plan's gap list). Review count in the
// stats row below is real (`useMyReviews`'s `total`); these two are not.
const PLACEHOLDER_PHOTO_COUNT = '—';
const PLACEHOLDER_LIKES_COUNT = '—';
// Same static goal as HomeScreen's gamification banner — no badge system exists.
const BADGE_GOAL = 25;

/**
 * Screen 23 (User Profile) per docs/04-screen-list.md. Module 2 scope was the
 * account-management essentials (display identity, Edit Profile, Logout);
 * build-prompts/08 adds the Settings menu link. Notifications is reachable
 * from the navbar bell (NotificationBellButton, shared across every MainTabs
 * screen) rather than from a row here. "Ngon v3" reskin adds a stats row and
 * badge-progress bar — review count is real, photo/likes counts and the
 * badge goal are static placeholders (rendered as "—", never a fabricated
 * number) since no backend exists for either.
 */
export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const myReviewsQuery = useMyReviews(1, 1);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const displayName = meQuery.data?.profile.displayName ?? '';
  const email = meQuery.data?.user.email ?? user?.email ?? '';
  const avatarUrl = meQuery.data?.profile.avatarUrl ?? null;
  const avatarInitial = displayName.trim().charAt(0).toUpperCase();
  const reviewCount = myReviewsQuery.data?.total;
  const badgeProgressPct = reviewCount !== undefined ? Math.min(100, (reviewCount / BADGE_GOAL) * 100) : 0;

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      // Best-effort, same rationale as the refresh-token invalidation below —
      // must happen before clearSession() clears the access token this
      // device needs to authenticate the unregister call.
      await unregisterPushNotificationsAsync().catch(() => undefined);
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) {
        // Best-effort: even if this fails (e.g. offline, already-invalid
        // token), we still clear the local session below so the user isn't
        // stuck logged in on-device.
        await authApi.logout({ refreshToken }).catch(() => undefined);
      }
    } finally {
      // Clearing the store flips isAuthenticated to false, which is what
      // RootNavigator uses to fall back to the Auth stack (task 7) — no
      // imperative navigation call needed.
      await clearSession();
      setIsLoggingOut(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {meQuery.isLoading ? (
        <ActivityIndicator style={styles.headerSpinner} color={colors.primary} />
      ) : (
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{avatarInitial || '?'}</Text>
            )}
          </View>
          <Text style={styles.displayName}>{displayName || t('nav.tabProfile')}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{reviewCount ?? '—'}</Text>
          <Text style={styles.statLabel}>{t('profile.statsReviews')}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardCyan]}>
          <Text style={styles.statValue}>{PLACEHOLDER_PHOTO_COUNT}</Text>
          <Text style={styles.statLabel}>{t('profile.statsPhotos')}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statValue}>{PLACEHOLDER_LIKES_COUNT}</Text>
          <Text style={styles.statLabel}>{t('profile.statsLikes')}</Text>
        </View>
      </View>

      <View style={styles.badgeCard}>
        <View style={styles.badgeHeaderRow}>
          <Text style={styles.badgeTitle}>{t('profile.badgeProgressTitle')}</Text>
          <Text style={styles.badgeCount}>{t('profile.badgeCount', { current: reviewCount ?? 0, goal: BADGE_GOAL })}</Text>
        </View>
        <View style={styles.badgeTrack}>
          <View style={[styles.badgeFill, { width: `${badgeProgressPct}%` }]} />
        </View>
      </View>

      <View style={styles.menuCard}>
        <Pressable style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={styles.menuItemText}>{t('nav.editProfile')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, styles.menuItemDivider]} onPress={() => navigation.navigate('MyReviews')}>
          <Text style={styles.menuItemText}>{t('nav.myReviews')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, styles.menuItemDivider]} onPress={() => navigation.navigate('MyContributions')}>
          <Text style={styles.menuItemText}>{t('nav.myContributions')}</Text>
        </Pressable>

        <Pressable style={[styles.menuItem, styles.menuItemDivider]} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.menuItemText}>{t('nav.settings')}</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.menuCard, styles.logoutCard]} onPress={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={[styles.menuItemText, styles.logoutText]}>{t('settings.logout')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    contentContainer: {
      gap: 16,
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: FLOATING_TAB_BAR_CLEARANCE,
    },
    headerSpinner: { marginVertical: 32 },
    header: { alignItems: 'center', paddingVertical: 24 },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 12,
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitial: { fontSize: 28, fontFamily: FONT_FAMILY.heading, color: colors.primary },
    displayName: { fontSize: 22, fontFamily: FONT_FAMILY.heading, color: colors.textPrimary },
    email: { fontSize: 14, color: colors.textSecondary, marginTop: 4, fontFamily: FONT_FAMILY.meta },
    statsRow: { flexDirection: 'row', gap: 10 },
    statCard: {
      flex: 1,
      padding: 14,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primarySurface,
      gap: 3,
    },
    statCardCyan: { backgroundColor: colors.accentCyanSurface, borderColor: colors.accentCyanSurface },
    statCardBlue: { backgroundColor: colors.primarySurface },
    statValue: { fontSize: 20, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    statLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
    badgeCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    badgeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    badgeTitle: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    badgeCount: { fontSize: 11, color: colors.textTertiary, fontFamily: FONT_FAMILY.meta },
    badgeTrack: { height: 10, borderRadius: 999, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
    badgeFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accentPink },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    menuItem: {
      paddingVertical: 16,
      paddingHorizontal: 18,
    },
    menuItemDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
    menuItemText: { fontSize: 16, fontFamily: FONT_FAMILY.bodyMedium, color: colors.textPrimary },
    logoutCard: { marginTop: 16, alignItems: 'center', paddingVertical: 16 },
    logoutText: { color: colors.error, fontFamily: FONT_FAMILY.bodyBold },
  });
