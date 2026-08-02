import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RestaurantSummaryDto } from '@foodmap/shared-types';
import type { MainStackParamList, MainTabParamList } from '../../navigation/types';
import { RestaurantCard, RestaurantCardSkeleton } from '../../components/RestaurantCard';
import { useFilterStore, countActiveFilters, type FilterValues } from '../../store/filterStore';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import { useRestaurantSearch } from '../../hooks/useRestaurantSearch';
import { useFavoriteIds, useToggleFavorite } from '../../hooks/useFavorites';
import { useTheme, type ThemeColors } from '../../theme/ThemeContext';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'List'>,
  NativeStackScreenProps<MainStackParamList>
>;

const SKELETON_COUNT = 6;

type SortOption = 'default' | 'distance' | 'rating' | 'price';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'default', label: 'Mặc định' },
  { key: 'distance', label: 'Gần nhất' },
  { key: 'rating', label: 'Đánh giá cao' },
  { key: 'price', label: 'Giá thấp' },
];

/** Client-side sort of the currently-loaded page(s) — the API has no `sort` param, so this only reorders what's already fetched, not the full result set. */
function sortItems(items: RestaurantSummaryDto[], sort: SortOption): RestaurantSummaryDto[] {
  if (sort === 'default') return items;
  const copy = [...items];
  if (sort === 'distance') {
    copy.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  } else if (sort === 'rating') {
    copy.sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  } else if (sort === 'price') {
    copy.sort((a, b) => (a.priceRange?.minVnd ?? Infinity) - (b.priceRange?.minVnd ?? Infinity));
  }
  return copy;
}

/**
 * Screen 8 (Home List) per docs/04-screen-list.md: the "Danh sách" tab —
 * browse via `GET /restaurants` (no search text) using the filter store's
 * current criteria, centered on the device's current location (falling
 * back to HCMC center via the shared `useDeviceLocation` hook — see
 * src/hooks/useDeviceLocation.ts, factored out of MapScreen for this reuse).
 */
export function ListScreen({ navigation }: Props) {
  const [sort, setSort] = useState<SortOption>('default');
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

  const { location, isResolved: locationResolved } = useDeviceLocation();

  const resultsQuery = useRestaurantSearch({ filters, location, enabled: locationResolved });
  const favoriteIdsQuery = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  const items: RestaurantSummaryDto[] = useMemo(
    () => sortItems(resultsQuery.data?.pages.flatMap((page) => page.items) ?? [], sort),
    [resultsQuery.data, sort],
  );
  const hasCachedData = resultsQuery.data !== undefined;

  const showInitialLoading = !locationResolved || (resultsQuery.isLoading && !hasCachedData);
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
        <Pressable style={styles.filterButton} onPress={() => navigation.navigate('Filter')}>
          <Text style={styles.filterButtonText}>
            Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => {
            const selected = sort === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.sortChip, selected && styles.sortChipSelected]}
                onPress={() => setSort(option.key)}
              >
                <Text style={[styles.sortChipText, selected && styles.sortChipTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {resultsQuery.isError && hasCachedData ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Không thể tải thêm quán.</Text>
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
          <Text style={styles.errorBody}>Không thể tải danh sách quán ăn. Vui lòng thử lại.</Text>
          <Pressable style={styles.retryButton} onPress={() => resultsQuery.refetch()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : showEmpty ? (
        <View style={styles.centeredContainer}>
          <Text style={styles.emptyTitle}>Không có quán nào trong khu vực này</Text>
          <Text style={styles.emptyHint}>Thử nới lỏng bộ lọc để xem thêm lựa chọn</Text>
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
      gap: 8,
    },
    filterButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
    },
    filterButtonText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.surfaceAlt },
    sortChipSelected: { backgroundColor: colors.primarySurface },
    sortChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    sortChipTextSelected: { color: colors.primary },
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
    emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    retryButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
    retryButtonText: { color: colors.onPrimary, fontWeight: '700' },
  });
