import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReviewCriteriaBreakdownDto, ReviewDto, ReviewSort } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { useRestaurantDetail } from '../../hooks/useRestaurantDetail';
import { useReviewList } from '../../hooks/useReviews';
import { useAuthStore } from '../../store/authStore';
import { ReviewCard } from '../../components/ReviewCard';
import { AuthGateModal } from '../../components/AuthGateModal';
import { CATEGORY_LABELS } from '../../lib/restaurantLabels';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'Reviews'>;

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  // These two currently behave identically to 'newest' server-side (no
  // helpfulness-vote model or review-photo support exists yet) — offered
  // here for forward-compat with the sort contract, not because they
  // produce different results today.
  { value: 'most_helpful', label: 'Hữu ích nhất' },
  { value: 'has_photos', label: 'Có ảnh' },
];

const RATING_FILTERS: (number | null)[] = [null, 5, 4, 3, 2, 1];

function RatingBreakdownRow({ item }: { item: ReviewCriteriaBreakdownDto }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const pct = item.averageScore !== null ? (item.averageScore / 5) * 100 : 0;
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel} numberOfLines={1}>
        {item.label}
      </Text>
      <View style={styles.breakdownBarTrack}>
        <View style={[styles.breakdownBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.breakdownValue}>
        {item.averageScore !== null ? item.averageScore.toFixed(1) : 'Chưa có đánh giá'}
        {item.averageScore !== null ? ` (${item.ratingCount})` : ''}
      </Text>
    </View>
  );
}

/**
 * Screen 15 (Reviews) per docs/build-prompts/06-reviews-scoring.md. Fetches
 * the restaurant header via the shared `useRestaurantDetail` cache (already
 * populated if the user navigated here from RestaurantDetailScreen) and the
 * paginated review list via `useReviewList`.
 */
export function ReviewsScreen({ route, navigation }: Props) {
  const { restaurantId } = route.params;
  const detailQuery = useRestaurantDetail(restaurantId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [filter, setFilter] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const reviewsQuery = useReviewList(restaurantId, { sort, filter: filter ?? undefined, page });

  function handleSortChange(value: ReviewSort) {
    setSort(value);
    setPage(1);
  }

  function handleFilterChange(value: number | null) {
    setFilter(value);
    setPage(1);
  }

  function handleWriteReview() {
    // RootNavigator renders MainStack (where this screen lives) only when
    // `isAuthenticated` is true — Main and Auth are mutually-exclusive
    // branches, not siblings — so a true guest can never reach this screen
    // today, making this branch dead code in practice. Kept anyway: it's a
    // cheap, forward-compatible guard in case guest browsing is ever added
    // to MainStack later, per the AuthGateModal scaffolding's original intent.
    if (!isAuthenticated) {
      setShowAuthGate(true);
      return;
    }
    navigation.navigate('WriteReview', { restaurantId });
  }

  const total = reviewsQuery.data?.total ?? 0;
  const pageSize = reviewsQuery.data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <View style={styles.container}>
      <FlatList<ReviewDto>
        data={reviewsQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {detailQuery.data ? (
              <View style={styles.headerBlock}>
                <Text style={styles.restaurantName}>{detailQuery.data.name}</Text>
                <Text style={styles.restaurantCategory}>
                  {CATEGORY_LABELS[detailQuery.data.categoryCode]}
                </Text>
              </View>
            ) : null}

            {reviewsQuery.data ? (
              <View style={styles.breakdownBlock}>
                <Text style={styles.sectionTitle}>Đánh giá theo tiêu chí</Text>
                {reviewsQuery.data.ratingBreakdown.map((item) => (
                  <RatingBreakdownRow key={item.code} item={item} />
                ))}
              </View>
            ) : null}

            <View style={styles.controlsBlock}>
              <Text style={styles.controlsLabel}>Sắp xếp</Text>
              <View style={styles.chipsRow}>
                {SORT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, sort === opt.value ? styles.chipActive : null]}
                    onPress={() => handleSortChange(opt.value)}
                  >
                    <Text style={[styles.chipText, sort === opt.value ? styles.chipTextActive : null]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.controlsLabel}>Lọc theo sao</Text>
              <View style={styles.chipsRow}>
                {RATING_FILTERS.map((value) => (
                  <Pressable
                    key={value ?? 'all'}
                    style={[styles.chip, filter === value ? styles.chipActive : null]}
                    onPress={() => handleFilterChange(value)}
                  >
                    <Text style={[styles.chipText, filter === value ? styles.chipTextActive : null]}>
                      {value === null ? 'Tất cả' : `${value}★`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {reviewsQuery.isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
            ) : null}

            {reviewsQuery.isError ? (
              <View style={styles.centeredBlock}>
                <Text style={styles.errorText}>Không thể tải đánh giá. Vui lòng thử lại.</Text>
                <Pressable style={styles.retryButton} onPress={() => reviewsQuery.refetch()}>
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </Pressable>
              </View>
            ) : null}

            {reviewsQuery.data && total === 0 ? (
              <View style={styles.centeredBlock}>
                <Text style={styles.emptyText}>
                  Chưa có đánh giá nào cho quán này. Hãy là người đầu tiên!
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          reviewsQuery.data && total > 0 && totalPages > 1 ? (
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

      <Pressable style={styles.fab} onPress={handleWriteReview}>
        <Text style={styles.fabText}>Viết đánh giá</Text>
      </Pressable>

      <AuthGateModal
        visible={showAuthGate}
        message="Đăng nhập để viết đánh giá."
        onDismiss={() => setShowAuthGate(false)}
        onLoginPress={() => setShowAuthGate(false)}
        onRegisterPress={() => setShowAuthGate(false)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingHorizontal: 16, paddingBottom: 100 },
    headerBlock: { paddingTop: 16, paddingBottom: 8 },
    restaurantName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    restaurantCategory: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    breakdownBlock: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    breakdownLabel: { fontSize: 12, color: colors.textSecondary, width: 110 },
    breakdownBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
    breakdownBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    breakdownValue: { fontSize: 11, color: colors.textSecondary, width: 92, textAlign: 'right' },
    controlsBlock: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
    controlsLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    chipActive: { backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    chipTextActive: { color: colors.onPrimary },
    loading: { marginVertical: 24 },
    centeredBlock: { paddingVertical: 32, alignItems: 'center' },
    errorText: { fontSize: 14, color: colors.error, marginBottom: 12, textAlign: 'center' },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
    emptyText: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: 24 },
    pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 20 },
    pagerButton: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
    pagerButtonDisabled: { opacity: 0.4 },
    pagerButtonText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    pagerLabel: { fontSize: 13, color: colors.textSecondary },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingVertical: 14,
      paddingHorizontal: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    fabText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
  });
