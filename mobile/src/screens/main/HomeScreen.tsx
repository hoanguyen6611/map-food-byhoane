import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantCategoryCode, RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { RestaurantGridCard } from '../../components/RestaurantGridCard';
import { RestaurantCardSkeleton } from '../../components/RestaurantCard';
import { authApi } from '../../api/auth';
import { useFilterStore, countActiveFilters, type FilterValues } from '../../store/filterStore';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRestaurantSearch } from '../../hooks/useRestaurantSearch';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useMyReviews } from '../../hooks/useReviews';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { CATEGORY_LABELS } from '../../lib/restaurantLabels';
import { FLOATING_TAB_BAR_CLEARANCE } from '../../navigation/tabConfig';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<MainStackParamList>
>;

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as RestaurantCategoryCode[];
// Only need a couple of rows for the "top rated" grid — Home is a browse
// entry point, not the full list (that's what Search/Filter are for).
const GRID_PAGE_SIZE = 8;
// Static goal for the gamification banner's badge-progress copy — no badge
// system exists in the backend (see the reskin plan's gap list), so this
// number is a fixed design placeholder, never computed from real data.
const BADGE_GOAL_REVIEWS = 3;

/**
 * "Ngon v3" Home tab (replaces the old List/"Danh sách" tab — build-prompts/04
 * scope, restyled). Same browse data source (`GET /restaurants`, no `q`,
 * filter-store criteria) as before; the mockup's gamification banner uses a
 * static goal (no badge/achievement backend exists) but its "Bắt đầu" button
 * still does something real — it starts the actual write-a-review flow.
 * The mockup's grid cards show per-DISH rating/price; since no dish-level
 * review data exists anywhere in the backend, this renders RESTAURANTS
 * instead of fabricating a fake per-dish score (see RestaurantGridCard.tsx).
 */
export function HomeScreen({ navigation }: Props) {
  const [category, setCategory] = useState<RestaurantCategoryCode | null>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const myReviewsQuery = useMyReviews(1, 1);
  const reviewsWrittenThisGoal = Math.min(myReviewsQuery.data?.total ?? 0, BADGE_GOAL_REVIEWS);

  const distanceKm = useFilterStore((s) => s.distanceKm);
  const priceMin = useFilterStore((s) => s.priceMin);
  const priceMax = useFilterStore((s) => s.priceMax);
  const minRating = useFilterStore((s) => s.minRating);
  const openNow = useFilterStore((s) => s.openNow);
  const facilities = useFilterStore((s) => s.facilities);
  const cuisine = useFilterStore((s) => s.cuisine);
  const province = useFilterStore((s) => s.province);
  const ward = useFilterStore((s) => s.ward);
  const filters: FilterValues = useMemo(
    () => ({ distanceKm, priceMin, priceMax, minRating, openNow, facilities, cuisine, province, ward }),
    [distanceKm, priceMin, priceMax, minRating, openNow, facilities, cuisine, province, ward],
  );
  const activeFilterCount = countActiveFilters(filters);

  const { location, isResolved: locationResolved } = useDeviceLocation();

  const resultsQuery = useRestaurantSearch({
    filters,
    location,
    enabled: locationResolved,
    category: category ?? undefined,
  });
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const items: RestaurantSummaryDto[] = (resultsQuery.data?.pages.flatMap((page) => page.items) ?? []).slice(
    0,
    GRID_PAGE_SIZE,
  );
  const hasCachedData = resultsQuery.data !== undefined;

  const showInitialLoading = !locationResolved || (resultsQuery.isLoading && !hasCachedData);
  const showFullError = resultsQuery.isError && !hasCachedData;
  const showEmpty = resultsQuery.isSuccess && items.length === 0;

  const displayName = meQuery.data?.profile.displayName ?? '';
  const avatarInitial = displayName.trim().charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <FlatList
        data={showInitialLoading || showFullError || showEmpty ? [] : items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.greetingRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{avatarInitial || '?'}</Text>
              </View>
              <View style={styles.greetingText}>
                <Text style={styles.greetingLabel}>{t('home.locationLabel')}</Text>
                <Text style={styles.greetingValue}>{t('home.staticCity')}</Text>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchBar}
                onPress={() => navigation.navigate('Search')}
                accessibilityRole="search"
                accessibilityLabel={t('home.searchPlaceholder')}
              >
                <Text style={styles.searchBarText}>{t('home.searchPlaceholder')}</Text>
              </Pressable>
              <Pressable
                style={styles.filterButton}
                onPress={() => navigation.navigate('Filter')}
                accessibilityRole="button"
                accessibilityLabel={t('list.filter')}
              >
                <Text style={styles.filterButtonText}>{activeFilterCount > 0 ? String(activeFilterCount) : '⚙︎'}</Text>
              </Pressable>
            </View>

            <View style={styles.gamificationBanner}>
              <View style={styles.gamificationTextBlock}>
                <View style={styles.gamificationPill}>
                  <Text style={styles.gamificationPillText}>{t('home.gamificationPill')}</Text>
                </View>
                <Text style={styles.gamificationTitle}>
                  {t('home.gamificationTitle', { goal: BADGE_GOAL_REVIEWS })}
                </Text>
                <Pressable
                  style={styles.gamificationButton}
                  onPress={() => navigation.navigate('SearchResult', { mode: 'writeReview' })}
                >
                  <Text style={styles.gamificationButtonText}>{t('home.gamificationButton')}</Text>
                </Pressable>
              </View>
              <View style={styles.gamificationBadge}>
                <Text style={styles.gamificationBadgeText}>
                  {reviewsWrittenThisGoal}/{BADGE_GOAL_REVIEWS}
                </Text>
              </View>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CATEGORY_OPTIONS}
              keyExtractor={(code) => code}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item: code }) => {
                const selected = category === code;
                return (
                  <Pressable
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setCategory((prev) => (prev === code ? null : code))}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {CATEGORY_LABELS[code]}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Text style={styles.sectionTitle}>{t('home.topRatedHeading')}</Text>

            {resultsQuery.isError && hasCachedData ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{t('list.errorLoadMore')}</Text>
                <Pressable onPress={() => resultsQuery.refetch()}>
                  <Text style={styles.errorBannerRetry}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : null}

            {showInitialLoading ? (
              <View style={styles.skeletonGrid}>
                <RestaurantCardSkeleton />
                <RestaurantCardSkeleton />
              </View>
            ) : showFullError ? (
              <View style={styles.centeredContainer}>
                <Text style={styles.errorTitle}>{t('common.noConnectionTitle')}</Text>
                <Text style={styles.errorBody}>{t('list.errorBody')}</Text>
                <Pressable style={styles.retryButton} onPress={() => resultsQuery.refetch()}>
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : showEmpty ? (
              <View style={styles.centeredContainer}>
                <Text style={styles.emptyTitle}>{t('list.emptyTitle')}</Text>
                <Text style={styles.emptyHint}>{t('list.emptyHint')}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <RestaurantGridCard
              restaurant={item}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
              isFavorited={favoriteIdsQuery.data?.has(item.id) ?? false}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  restaurantId: item.id,
                  isFavorited: favoriteIdsQuery.data?.has(item.id) ?? false,
                })
              }
            />
          </View>
        )}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingBottom: 16 + FLOATING_TAB_BAR_CLEARANCE },
    headerBlock: { gap: 20, paddingTop: 4 },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarCircle: {
      width: 44,
      height: 44,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primarySurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontSize: 14, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    greetingText: { flex: 1, gap: 2 },
    greetingLabel: { fontSize: 11, color: colors.textTertiary, fontFamily: FONT_FAMILY.meta },
    greetingValue: { fontSize: 14, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textPrimary },
    searchRow: { flexDirection: 'row', gap: 10 },
    searchBar: {
      flex: 1,
      height: 50,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 18,
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    searchBarText: { color: colors.textTertiary, fontSize: 14, fontFamily: FONT_FAMILY.body },
    filterButton: {
      width: 50,
      height: 50,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterButtonText: { color: colors.onPrimary, fontSize: 15, fontFamily: FONT_FAMILY.buttonSemiBold },
    gamificationBanner: {
      borderRadius: 24,
      padding: 18,
      backgroundColor: colors.accentCyanSurface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    gamificationTextBlock: { flex: 1, gap: 10 },
    gamificationPill: {
      alignSelf: 'flex-start',
      height: 22,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gamificationPillText: { fontSize: 10, fontFamily: FONT_FAMILY.metaMedium, color: colors.textPrimary },
    gamificationTitle: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, lineHeight: 21 },
    gamificationButton: {
      alignSelf: 'flex-start',
      height: 34,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gamificationButtonText: { color: colors.onPrimary, fontSize: 13, fontFamily: FONT_FAMILY.button },
    gamificationBadge: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gamificationBadgeText: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    chipRow: { gap: 8, paddingRight: 4 },
    chip: {
      height: 38,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontFamily: FONT_FAMILY.bodyMedium, color: colors.textSecondary },
    chipTextSelected: { color: colors.onPrimary },
    sectionTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    gridRow: { gap: 12 },
    gridItem: { flex: 1 },
    skeletonGrid: { flexDirection: 'row', gap: 12 },
    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.overlayBanner,
      borderRadius: 14,
      padding: 12,
    },
    errorBannerText: { color: colors.overlayBannerText, fontSize: 13, flex: 1 },
    errorBannerRetry: { color: colors.overlayBannerLink, fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, marginLeft: 12 },
    centeredContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 16 },
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
    emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    retryButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
  });
