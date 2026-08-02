import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotificationDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useMarkNotificationRead, useNotificationsList } from '../../hooks/useNotifications';
import { formatRelativeDate } from '../../lib/format';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

const PAGE_SIZE = 20;

// Only screens this build actually knows how to deep-link into with the data
// a NotificationDto carries. `SubmissionStatus` IS a registered route, but it
// requires a `contributionId` param the notification payload doesn't carry
// (Module 7's moderation queue — the real producer — doesn't exist yet, so
// there's no way to know which contribution to show) — tapping one just
// marks it read instead of navigating into a screen with missing params.
const NAVIGABLE_SCREENS = new Set(['Reviews']);

function NotificationRow({
  notification,
  onPress,
  colors,
}: {
  notification: NotificationDto;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const styles = createStyles(colors);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {!notification.isRead ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
      <View style={styles.rowBody}>
        <Text style={[styles.title, !notification.isRead && styles.titleUnread]} numberOfLines={2}>
          {notification.payload.title}
        </Text>
        <Text style={styles.body} numberOfLines={3}>
          {notification.payload.body}
        </Text>
        <Text style={styles.date}>{formatRelativeDate(notification.createdAt)}</Text>
      </View>
      {!notification.isRead ? (
        <Ionicons name="ellipse" size={8} color={colors.primary} style={styles.trailingDot} />
      ) : null}
    </Pressable>
  );
}

/**
 * Notifications screen per build-prompts/08. Reachable only from
 * ProfileScreen's menu (post-login) — same MainStack-only-when-authenticated
 * architecture as Favorites/Settings, so no AuthGateModal guard needed.
 *
 * No real producer exists yet (Module 7's moderation queue) — see
 * backend/prisma/seed-notifications.ts for how to seed demo rows against a
 * real test account for manual verification.
 */
export function NotificationsScreen({ navigation }: Props) {
  const [page, setPage] = useState(1);
  const notificationsQuery = useNotificationsList(page, PAGE_SIZE);
  const markRead = useMarkNotificationRead();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const items = notificationsQuery.data?.items ?? [];
  const total = notificationsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showEmpty = notificationsQuery.isSuccess && items.length === 0;

  function handlePress(notification: NotificationDto) {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }
    const { screen, restaurantId } = notification.payload.deepLink;
    if (screen === 'Reviews' && restaurantId && NAVIGABLE_SCREENS.has(screen)) {
      navigation.navigate('Reviews', { restaurantId });
    }
    // Any other/unrecognized screen name: mark-read only, no navigation.
  }

  if (notificationsQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notificationsQuery.isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>Không có kết nối</Text>
        <Text style={styles.errorBody}>Không thể tải thông báo. Vui lòng thử lại.</Text>
        <Pressable style={styles.retryButton} onPress={() => notificationsQuery.refetch()}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>Bạn chưa có thông báo nào.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => handlePress(item)} colors={colors} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagerRow}>
              <Pressable
                style={[styles.pagerButton, page <= 1 ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <Text style={styles.pagerButtonText}>Trước</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>
                Trang {page}/{totalPages}
              </Text>
              <Pressable
                style={[styles.pagerButton, page >= totalPages ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <Text style={styles.pagerButtonText}>Sau</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centeredContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 32,
    },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
    unreadDotSpacer: { width: 8, height: 8, marginTop: 6 },
    rowBody: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    titleUnread: { fontWeight: '800', color: colors.textPrimary },
    body: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    date: { fontSize: 11, color: colors.textTertiary, marginTop: 6 },
    trailingDot: { marginTop: 6 },
    separator: { height: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary },
  });
