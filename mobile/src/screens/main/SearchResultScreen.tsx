import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { RestaurantCard, RestaurantCardSkeleton } from '../../components/RestaurantCard';
import { restaurantsApi } from '../../api/restaurants';
import { useFilterStore, countActiveFilters, type FilterValues } from '../../store/filterStore';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRestaurantSearch } from '../../hooks/useRestaurantSearch';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';
import { FONT_FAMILY } from '../../theme/fonts';
import { CATEGORY_LABELS } from '../../lib/restaurantLabels';

const NEARBY_ALTERNATIVES_COUNT = 5;

type Props = NativeStackScreenProps<MainStackParamList, 'SearchResult'>;

const SKELETON_COUNT = 6;

/**
 * Screen 10 (Search Result) per docs/04-screen-list.md: text query (from
 * route params) + the current filter store's criteria, fetched via
 * `GET /search`, rendered as a list of the shared `RestaurantCard`.
 * Pagination is a manual "load more at scroll end" via `useInfiniteQuery`.
 */
export function SearchResultScreen({ route, navigation }: Props) {
  const query = route.params?.query;
  const isWriteReviewPick = route.params?.mode === 'writeReview';
  // Arriving with only a `category` (Explore's category tiles) or with both a
  // `category` and a `query` (re-submitting a search while a category is
  // still active, see SearchScreen.tsx) has no other on-screen indicator that
  // the category filter is applied — the header must name it, or "Tất cả kết
  // quả"/"Kết quả cho ..." reads as if nothing is filtered when it is.
  const categoryLabel = route.params?.category ? CATEGORY_LABELS[route.params.category] : undefined;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  // Selecting individual primitives (rather than the whole store object)
  // keeps re-renders scoped to actual filter changes — the resulting object
  // is rebuilt each render, but that's harmless since it only feeds a React
  // Query `queryKey`, which is compared structurally, not by reference.
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

  const { location } = useDeviceLocation();

  const resultsQuery = useRestaurantSearch({ query, filters, location, category: route.params?.category });
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const items: RestaurantSummaryDto[] = resultsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = resultsQuery.data?.pages[0]?.total ?? 0;
  const hasCachedData = resultsQuery.data !== undefined;

  const showInitialLoading = resultsQuery.isLoading && !hasCachedData;
  const showFullError = resultsQuery.isError && !hasCachedData;
  const showEmpty = resultsQuery.isSuccess && items.length === 0;

  // "gợi ý nới lỏng bộ lọc + quán gần đó thay thế" per screen 10's empty
  // state spec — the "relax filters" half already existed (Mở bộ lọc
  // button); this ignores the query/filters entirely and just shows what's
  // physically nearby, same /restaurants/nearby endpoint Home Map could use.
  const nearbyAlternativesQuery = useQuery({
    queryKey: ['search-nearby-alternatives', location?.latitude, location?.longitude],
    queryFn: () => restaurantsApi.nearby(location!.latitude, location!.longitude),
    enabled: showEmpty && location !== null,
  });
  const nearbyAlternatives = (nearbyAlternativesQuery.data ?? []).slice(0, NEARBY_ALTERNATIVES_COUNT);

  function handleLoadMore() {
    if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) {
      resultsQuery.fetchNextPage();
    }
  }

  // Reached via FloatingTabBar's "Viết" shortcut (see tabConfig.ts) — this
  // same search flow doubles as the "pick a restaurant to review" step, so
  // a card tap goes straight to WriteReview instead of RestaurantDetail.
  function handleCardPress(restaurantId: string) {
    if (isWriteReviewPick) {
      navigation.navigate('WriteReview', { restaurantId });
    } else {
      navigation.navigate('RestaurantDetail', { restaurantId });
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText} numberOfLines={1}>
          {isWriteReviewPick
            ? t('searchResult.headerPickForReview')
            : query && categoryLabel
              ? t('searchResult.headerForQueryAndCategory', { query, category: categoryLabel })
              : query
                ? t('searchResult.headerForQuery', { query })
                : categoryLabel
                  ? t('searchResult.headerForCategory', { category: categoryLabel })
                  : t('searchResult.headerAll')}
          {resultsQuery.isSuccess ? ` · ${total}` : ''}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              navigation.navigate('Search', { mode: route.params?.mode, category: route.params?.category })
            }
          >
            <Text style={styles.headerButtonText}>{t('searchResult.editSearch')}</Text>
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Filter')}>
            <Text style={styles.headerButtonText}>
              {activeFilterCount > 0
                ? t('searchResult.filterWithCount', { count: activeFilterCount })
                : t('searchResult.filter')}
            </Text>
          </Pressable>
        </View>
      </View>

      {resultsQuery.isError && hasCachedData ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{t('searchResult.errorLoadMore')}</Text>
          <Pressable onPress={() => resultsQuery.refetch()}>
            <Text style={styles.errorBannerRetry}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}

      {showInitialLoading ? (
        <View style={styles.listContent}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <RestaurantCardSkeleton key={index} />
          ))}
        </View>
      ) : showFullError ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.errorTitle}>{t('searchResult.errorTitle')}</Text>
          <Text style={styles.errorBody}>{t('searchResult.errorBody')}</Text>
          <Pressable style={styles.retryButton} onPress={() => resultsQuery.refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : showEmpty ? (
        <FlatList
          data={nearbyAlternatives}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.emptyHeader}>
              <Text style={styles.emptyTitle}>{t('searchResult.emptyTitle')}</Text>
              <Text style={styles.emptyHint}>{t('searchResult.emptyHint')}</Text>
              <Pressable style={styles.retryButton} onPress={() => navigation.navigate('Filter')}>
                <Text style={styles.retryButtonText}>{t('searchResult.openFilter')}</Text>
              </Pressable>
              {nearbyAlternatives.length > 0 ? (
                <Text style={styles.nearbyTitle}>{t('searchResult.nearbyTitle')}</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => handleCardPress(item.id)}
              isFavorited={favoriteIdsQuery.data?.has(item.id) ?? false}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  restaurantId: item.id,
                  isFavorited: favoriteIdsQuery.data?.has(item.id) ?? false,
                })
              }
            />
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => handleCardPress(item.id)}
              isFavorited={favoriteIdsQuery.data?.has(item.id) ?? false}
              onToggleFavorite={() =>
                toggleFavorite.mutate({
                  restaurantId: item.id,
                  isFavorited: favoriteIdsQuery.data?.has(item.id) ?? false,
                })
              }
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMore}
          ListFooterComponent={
            resultsQuery.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} size="small" color={colors.primary} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundAlt },
    headerBar: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    headerText: { fontSize: 15, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary },
    headerActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    headerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
    },
    headerButtonText: { fontSize: 12, fontFamily: FONT_FAMILY.bodySemiBold, color: colors.textSecondary },
    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.overlayBanner,
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 14,
      padding: 12,
    },
    errorBannerText: { color: colors.overlayBannerText, fontSize: 13, flex: 1 },
    errorBannerRetry: { color: colors.overlayBannerLink, fontFamily: FONT_FAMILY.bodyBold, fontSize: 13, marginLeft: 12 },
    listContent: { padding: 16 },
    footerSpinner: { marginVertical: 16 },
    centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    errorTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bodyBold, color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    emptyHeader: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 8 },
    emptyTitle: { fontSize: 16, fontFamily: FONT_FAMILY.bodyBold, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
    emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    nearbyTitle: {
      alignSelf: 'flex-start',
      fontSize: 14,
      fontFamily: FONT_FAMILY.bodyBold,
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    retryButton: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontFamily: FONT_FAMILY.buttonSemiBold },
  });
