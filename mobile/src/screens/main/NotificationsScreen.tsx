import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NotificationDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useMarkNotificationRead, useNotificationsList } from '../../hooks/useNotifications';
import { formatRelativeDate } from '../../lib/format';
import { resolveNotificationTarget } from '../../lib/notificationNavigation';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';

type Props = NativeStackScreenProps<MainStackParamList, 'Notifications'>;

const PAGE_SIZE = 20;

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
  const { t } = useTranslation();
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
    const target = resolveNotificationTarget(notification.payload.deepLink);
    if (target) {
      navigation.navigate(...target);
    }
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
        <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
        <Text style={styles.errorBody}>{t('notifications.errorBody')}</Text>
        <Pressable style={styles.retryButton} onPress={() => notificationsQuery.refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>{t('notifications.emptyText')}</Text>
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
                <Text style={styles.pagerButtonText}>{t('common.prev')}</Text>
              </Pressable>
              <Text style={styles.pagerLabel}>{t('common.pageOf', { page, totalPages })}</Text>
              <Pressable
                style={[styles.pagerButton, page >= totalPages ? styles.pagerButtonDisabled : null]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <Text style={styles.pagerButtonText}>{t('common.next')}</Text>
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
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontFamily: FONT_FAMILY.bodySemiBold, textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
    unreadDotSpacer: { width: 8, height: 8, marginTop: 6 },
    rowBody: { flex: 1 },
    title: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    titleUnread: { fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    body: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18, fontFamily: FONT_FAMILY.body },
    date: { fontSize: 11, color: colors.textTertiary, marginTop: 6, fontFamily: FONT_FAMILY.meta },
    trailingDot: { marginTop: 6 },
    separator: { height: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary, fontFamily: FONT_FAMILY.meta },
  });
