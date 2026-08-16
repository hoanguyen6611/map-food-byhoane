import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MyReviewDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useMyReviews } from '../../hooks/useReviews';
import { formatReviewDate } from '../../lib/reviewLabels';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'MyReviews'>;

const PAGE_SIZE = 20;

function Stars({ rating, colors, styles }: { rating: number; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rating ? 'star' : 'star-outline'} size={13} color={colors.star} />
      ))}
    </View>
  );
}

function MyReviewRow({ review, onPress, colors }: { review: MyReviewDto; onPress: () => void; colors: ThemeColors }) {
  const { t } = useTranslation();
  const styles = createStyles(colors);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.thumb}>
        {review.restaurant.thumbnailUrl ? (
          <Image source={{ uri: review.restaurant.thumbnailUrl }} style={styles.thumbImage} />
        ) : (
          <Ionicons name="restaurant-outline" size={20} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.restaurantName} numberOfLines={1}>
          {review.restaurant.name}
        </Text>
        <View style={styles.ratingRow}>
          <Stars rating={review.overallRating} colors={colors} styles={styles} />
          {review.status === 'pending' ? (
            <View style={[styles.badge, styles.badgePending]}>
              <Text style={styles.badgeText}>{t('review.pending')}</Text>
            </View>
          ) : null}
          {review.status === 'rejected' || review.status === 'hidden' ? (
            <View style={[styles.badge, styles.badgeRejected]}>
              <Text style={[styles.badgeText, styles.badgeTextRejected]}>{t(`myReviews.status_${review.status}`)}</Text>
            </View>
          ) : null}
        </View>
        {review.comment ? (
          <Text style={styles.comment} numberOfLines={2}>
            {review.comment}
          </Text>
        ) : null}
        <Text style={styles.date}>{formatReviewDate(review.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

/** Profile → "My Reviews" — every review the current user has written, across all restaurants and statuses, newest first. */
export function MyReviewsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const reviewsQuery = useMyReviews(page, PAGE_SIZE);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const items = reviewsQuery.data?.items ?? [];
  const total = reviewsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showEmpty = reviewsQuery.isSuccess && items.length === 0;

  if (reviewsQuery.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (reviewsQuery.isError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
        <Text style={styles.errorBody}>{t('myReviews.errorBody')}</Text>
        <Pressable style={styles.retryButton} onPress={() => reviewsQuery.refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (showEmpty) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.emptyText}>{t('myReviews.emptyText')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MyReviewRow
            review={item}
            colors={colors}
            onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.restaurant.id })}
          />
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
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 15, color: colors.textTertiary, fontWeight: '600', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImage: { width: '100%', height: '100%' },
    rowBody: { flex: 1 },
    restaurantName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    starsRow: { flexDirection: 'row', gap: 1 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
    badgePending: { backgroundColor: colors.warningBg },
    badgeRejected: { backgroundColor: colors.errorBg },
    badgeText: { fontSize: 10, fontWeight: '700', color: colors.warning },
    badgeTextRejected: { color: colors.error },
    comment: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    date: { fontSize: 11, color: colors.textTertiary, marginTop: 6 },
    separator: { height: 1, backgroundColor: colors.divider, marginHorizontal: 16 },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary },
  });
