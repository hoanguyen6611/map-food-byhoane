import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList } from '../../navigation/types';
import { RestaurantCard, RestaurantCardSkeleton } from '../../components/RestaurantCard';
import { useFilterStore, countActiveFilters, type FilterValues } from '../../store/filterStore';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRestaurantSearch } from '../../hooks/useRestaurantSearch';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

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
  const { colors } = useTheme();
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
  const filters: FilterValues = useMemo(
    () => ({ distanceKm, priceMin, priceMax, minRating, openNow, facilities, cuisine }),
    [distanceKm, priceMin, priceMax, minRating, openNow, facilities, cuisine],
  );
  const activeFilterCount = countActiveFilters(filters);

  const { location } = useDeviceLocation();

  const resultsQuery = useRestaurantSearch({ query, filters, location });
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const items: RestaurantSummaryDto[] = resultsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = resultsQuery.data?.pages[0]?.total ?? 0;
  const hasCachedData = resultsQuery.data !== undefined;

  const showInitialLoading = resultsQuery.isLoading && !hasCachedData;
  const showFullError = resultsQuery.isError && !hasCachedData;
  const showEmpty = resultsQuery.isSuccess && items.length === 0;

  function handleLoadMore() {
    if (resultsQuery.hasNextPage && !resultsQuery.isFetchingNextPage) {
      resultsQuery.fetchNextPage();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText} numberOfLines={1}>
          {query ? `Kết quả cho "${query}"` : 'Tất cả kết quả'}
          {resultsQuery.isSuccess ? ` · ${total}` : ''}
        </Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Search')}>
            <Text style={styles.headerButtonText}>Sửa tìm kiếm</Text>
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Filter')}>
            <Text style={styles.headerButtonText}>
              Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {resultsQuery.isError && hasCachedData ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Không thể tải thêm kết quả.</Text>
          <Pressable onPress={() => resultsQuery.refetch()}>
            <Text style={styles.errorBannerRetry}>Thử lại</Text>
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
          <Text style={styles.errorTitle}>Không có kết nối</Text>
          <Text style={styles.errorBody}>Không thể tải kết quả tìm kiếm. Vui lòng thử lại.</Text>
          <Pressable style={styles.retryButton} onPress={() => resultsQuery.refetch()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : showEmpty ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.emptyTitle}>Không tìm thấy quán phù hợp</Text>
          <Text style={styles.emptyHint}>Thử nới lỏng bộ lọc (khoảng cách, giá, đánh giá) hoặc đổi từ khoá.</Text>
          <Pressable style={styles.retryButton} onPress={() => navigation.navigate('Filter')}>
            <Text style={styles.retryButtonText}>Mở bộ lọc</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <RestaurantCard
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
    headerText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    headerActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    headerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    headerButtonText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.overlayBanner,
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 10,
      padding: 12,
    },
    errorBannerText: { color: colors.overlayBannerText, fontSize: 13, flex: 1 },
    errorBannerRetry: { color: colors.overlayBannerLink, fontWeight: '700', fontSize: 13, marginLeft: 12 },
    listContent: { padding: 16 },
    footerSpinner: { marginVertical: 16 },
    centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    errorTitle: { fontSize: 18, fontWeight: '700', color: colors.error, marginBottom: 8 },
    errorBody: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
    emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
  });
